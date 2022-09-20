// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PinholeCameraModel } from "@foxglove/den/image";
import Logger from "@foxglove/log";
import { toNanoSec } from "@foxglove/rostime";
import { CameraCalibration } from "@foxglove/schemas";
import { SettingsTreeAction, SettingsTreeFields } from "@foxglove/studio";
import type { RosValue } from "@foxglove/studio-base/players/types";
import { MutablePoint } from "@foxglove/studio-base/types/Messages";

import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { PartialMessage, PartialMessageEvent, SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { makeRgba, rgbaToCssString, stringToRgba } from "../color";
import { CAMERA_CALIBRATION_DATATYPES } from "../foxglove";
import { normalizeHeader, normalizeTime } from "../normalizeMessages";
import {
  CameraInfo,
  CAMERA_INFO_DATATYPES as ROS_CAMERA_INFO_DATATYPES,
  IncomingCameraInfo,
  Marker,
  MarkerAction,
  MarkerType,
  Matrix3,
  Matrix3x4,
  RegionOfInterest,
  TIME_ZERO,
} from "../ros";
import { BaseSettings, fieldLineWidth, fieldSize } from "../settings";
import { makePose } from "../transforms";
import { RenderableLineList } from "./markers/RenderableLineList";

const log = Logger.getLogger(__filename);
void log;

export type LayerSettingsCameraInfo = BaseSettings & {
  distance: number;
  width: number;
  color: string;
};

const DEFAULT_DISTANCE = 1;
const DEFAULT_WIDTH = 0.01;

const DEFAULT_COLOR = { r: 124 / 255, g: 107 / 255, b: 1, a: 1 };

const DEFAULT_COLOR_STR = rgbaToCssString(DEFAULT_COLOR);

const CAMERA_MODEL = "CameraModel";

const DEFAULT_SETTINGS: LayerSettingsCameraInfo = {
  visible: false,
  frameLocked: true,
  distance: DEFAULT_DISTANCE,
  width: DEFAULT_WIDTH,
  color: DEFAULT_COLOR_STR,
};

export type CameraInfoUserData = BaseUserData & {
  settings: LayerSettingsCameraInfo;
  topic: string;
  cameraInfo: CameraInfo | undefined;
  originalMessage: Record<string, RosValue> | undefined;
  cameraModel: PinholeCameraModel | undefined;
  lines: RenderableLineList | undefined;
};

export class CameraInfoRenderable extends Renderable<CameraInfoUserData> {
  public override dispose(): void {
    this.userData.lines?.dispose();
    super.dispose();
  }

  public override details(): Record<string, RosValue> {
    return this.userData.originalMessage ?? {};
  }
}

export class Cameras extends SceneExtension<CameraInfoRenderable> {
  public constructor(renderer: Renderer) {
    super("foxglove.Cameras", renderer);

    renderer.addDatatypeSubscriptions(ROS_CAMERA_INFO_DATATYPES, this.handleCameraInfo);
    renderer.addDatatypeSubscriptions(CAMERA_CALIBRATION_DATATYPES, this.handleCameraInfo);
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const topic of this.renderer.topics ?? []) {
      if (
        ROS_CAMERA_INFO_DATATYPES.has(topic.datatype) ||
        CAMERA_CALIBRATION_DATATYPES.has(topic.datatype)
      ) {
        const config = (configTopics[topic.name] ?? {}) as Partial<LayerSettingsCameraInfo>;

        // prettier-ignore
        const fields: SettingsTreeFields = {
          distance: fieldSize("Distance", config.distance, DEFAULT_DISTANCE),
          width: fieldLineWidth("Line Width", config.width, DEFAULT_WIDTH),
          color: { label: "Color", input: "rgba", value: config.color ?? DEFAULT_COLOR_STR },
        };

        entries.push({
          path: ["topics", topic.name],
          node: {
            icon: "Camera",
            fields,
            visible: config.visible ?? DEFAULT_SETTINGS.visible,
            handler,
            order: topic.name.toLocaleLowerCase(),
          },
        });
      }
    }
    return entries;
  }

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    if (action.action !== "update" || path.length !== 3) {
      return;
    }

    this.saveSetting(path, action.payload.value);

    // Update the renderable
    const topicName = path[1]!;
    const renderable = this.renderables.get(topicName);
    if (renderable) {
      const { cameraInfo, receiveTime, originalMessage } = renderable.userData;
      if (cameraInfo) {
        const settings = this.renderer.config.topics[topicName] as
          | Partial<LayerSettingsCameraInfo>
          | undefined;
        this._updateCameraInfoRenderable(
          renderable,
          cameraInfo,
          originalMessage,
          receiveTime,
          settings,
        );
      }
    }
  };

  private handleCameraInfo = (
    messageEvent: PartialMessageEvent<IncomingCameraInfo | CameraCalibration>,
  ): void => {
    const topic = messageEvent.topic;
    const cameraInfo = normalizeCameraInfo(messageEvent.message);
    const receiveTime = toNanoSec(messageEvent.receiveTime);

    let renderable = this.renderables.get(topic);
    if (!renderable) {
      const messageTime = toNanoSec(cameraInfo.header.stamp);
      const frameId = this.renderer.normalizeFrameId(cameraInfo.header.frame_id);

      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsCameraInfo>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...userSettings };

      renderable = new CameraInfoRenderable(topic, this.renderer, {
        receiveTime,
        messageTime,
        frameId,
        pose: makePose(),
        settingsPath: ["topics", topic],
        settings,
        topic,
        cameraInfo: undefined,
        originalMessage: undefined,
        cameraModel: undefined,
        lines: undefined,
      });

      this.add(renderable);
      this.renderables.set(topic, renderable);
    }

    this._updateCameraInfoRenderable(
      renderable,
      cameraInfo,
      messageEvent.message,
      receiveTime,
      renderable.userData.settings,
    );
  };

  private _updateCameraInfoRenderable(
    renderable: CameraInfoRenderable,
    cameraInfo: CameraInfo,
    originalMessage: Record<string, RosValue> | undefined,
    receiveTime: bigint,
    settings: Partial<LayerSettingsCameraInfo> | undefined,
  ): void {
    const prevSettings = renderable.userData.settings;
    const newSettings = { ...DEFAULT_SETTINGS, ...settings };
    const settingsEqual =
      newSettings.color === prevSettings.color &&
      newSettings.distance === prevSettings.distance &&
      newSettings.width === prevSettings.width;
    const topic = renderable.userData.topic;

    renderable.userData.receiveTime = receiveTime;
    renderable.userData.messageTime = toNanoSec(cameraInfo.header.stamp);
    renderable.userData.frameId = this.renderer.normalizeFrameId(cameraInfo.header.frame_id);
    renderable.userData.settings = newSettings;

    // If the CameraInfo message contents changed, rebuild cameraModel
    const dataEqual = cameraInfosEqual(renderable.userData.cameraInfo, cameraInfo);
    if (!dataEqual) {
      // log.warn(`CameraInfo changed on topic "${topic}", updating rectification model`);
      renderable.userData.cameraInfo = cameraInfo;
      renderable.userData.originalMessage = originalMessage;

      if (cameraInfo.P.length === 12) {
        try {
          renderable.userData.cameraModel = new PinholeCameraModel(cameraInfo);
        } catch (errUnk) {
          const err = errUnk as Error;
          this.renderer.settings.errors.addToTopic(topic, CAMERA_MODEL, err.message);
          renderable.userData.cameraModel = undefined;
          if (renderable.userData.lines) {
            renderable.remove(renderable.userData.lines);
            renderable.userData.lines.dispose();
            renderable.userData.lines = undefined;
          }
        }
      } else {
        this.renderer.settings.errors.addToTopic(
          topic,
          CAMERA_MODEL,
          `P has length ${cameraInfo.P.length}, not a 3x4 matrix`,
        );
      }
    }

    // If the CameraInfo message contents changed or the settings changed, redraw the wireframe
    if (
      renderable.userData.cameraModel?.P != undefined &&
      (!dataEqual || !settingsEqual || !renderable.userData.lines)
    ) {
      this.renderer.settings.errors.removeFromTopic(topic, CAMERA_MODEL);

      // Synthesize a LINE_LIST marker to instantiate or update a RenderableLineList
      const marker = createLineListMarker(
        cameraInfo,
        renderable.userData.cameraModel,
        renderable.userData.settings,
      );
      if (!renderable.userData.lines) {
        renderable.userData.lines = new RenderableLineList(topic, marker, undefined, this.renderer);
        renderable.add(renderable.userData.lines);
      } else {
        renderable.userData.lines.update(marker, undefined);
      }
    }
  }
}

function vec3(): MutablePoint {
  return { x: 0, y: 0, z: 0 };
}

function createLineListMarker(
  cameraInfo: CameraInfo,
  cameraModel: PinholeCameraModel,
  settings: LayerSettingsCameraInfo,
  steps = 10,
): Marker {
  const { distance: depth, width } = settings;

  // Create the four lines from the camera origin to the four corners of the image
  const uv = { x: 0, y: 0 };
  const tl = vec3();
  cameraModel.projectPixelTo3dRay(tl, cameraModel.rectifyPixel(uv, uv));
  multiplyScalar(tl, depth);

  uv.x = cameraInfo.width;
  uv.y = 0;
  const tr = vec3();
  cameraModel.projectPixelTo3dRay(tr, cameraModel.rectifyPixel(uv, uv));
  multiplyScalar(tr, depth);

  uv.x = 0;
  uv.y = cameraInfo.height;
  const bl = vec3();
  cameraModel.projectPixelTo3dRay(bl, cameraModel.rectifyPixel(uv, uv));
  multiplyScalar(bl, depth);

  uv.x = cameraInfo.width;
  uv.y = cameraInfo.height;
  const br = vec3();
  cameraModel.projectPixelTo3dRay(br, cameraModel.rectifyPixel(uv, uv));
  multiplyScalar(br, depth);

  const origin = vec3();
  const points = [origin, tl, origin, tr, origin, br, origin, bl];

  // Top-left -> top-right
  points.push(tl);
  horizontalLine(points, 0, cameraInfo, cameraModel, steps, depth);
  points.push(tr);

  // Bottom-left -> bottom-right
  points.push(bl);
  horizontalLine(points, cameraInfo.height, cameraInfo, cameraModel, steps, depth);
  points.push(br);

  // Top-left -> bottom-left
  points.push(tl);
  verticalLine(points, 0, cameraInfo, cameraModel, steps, depth);
  points.push(bl);

  // Top-right -> bottom-right
  points.push(tr);
  verticalLine(points, cameraInfo.width, cameraInfo, cameraModel, steps, depth);
  points.push(br);

  return {
    header: cameraInfo.header,
    ns: "",
    id: 0,
    type: MarkerType.LINE_LIST,
    action: MarkerAction.ADD,
    pose: makePose(),
    scale: { x: width, y: width, z: width },
    color: stringToRgba(makeRgba(), settings.color),
    lifetime: TIME_ZERO,
    frame_locked: true,
    points,
    colors: [],
    text: "",
    mesh_resource: "",
    mesh_use_embedded_materials: false,
  };
}

function horizontalLine(
  output: MutablePoint[],
  y: number,
  cameraInfo: CameraInfo,
  cameraModel: PinholeCameraModel,
  steps: number,
  depth: number,
): void {
  const uv = { x: 0, y: 0 };
  for (let i = 1; i < steps; i++) {
    uv.x = (i / steps) * cameraInfo.width;
    uv.y = y;
    const p = vec3();
    cameraModel.projectPixelTo3dRay(p, cameraModel.rectifyPixel(uv, uv));
    multiplyScalar(p, depth);
    output.push(p, p);
  }
}

function verticalLine(
  output: MutablePoint[],
  x: number,
  cameraInfo: CameraInfo,
  cameraModel: PinholeCameraModel,
  steps: number,
  depth: number,
): void {
  const uv = { x: 0, y: 0 };
  for (let i = 1; i < steps; i++) {
    uv.x = x;
    uv.y = (i / steps) * cameraInfo.height;
    const p = vec3();
    cameraModel.projectPixelTo3dRay(p, cameraModel.rectifyPixel(uv, uv));
    multiplyScalar(p, depth);
    output.push(p, p);
  }
}

function cameraInfosEqual(a: CameraInfo | undefined, b: CameraInfo | undefined): boolean {
  if (!a || !b) {
    return a === b;
  } else if (a === b) {
    return true;
  }

  if (
    !(
      a.header.frame_id === b.header.frame_id &&
      a.width === b.width &&
      a.height === b.height &&
      a.distortion_model === b.distortion_model &&
      a.binning_x === b.binning_x &&
      a.binning_y === b.binning_y &&
      a.roi.x_offset === b.roi.x_offset &&
      a.roi.y_offset === b.roi.y_offset &&
      a.roi.height === b.roi.height &&
      a.roi.width === b.roi.width &&
      a.roi.do_rectify === b.roi.do_rectify &&
      a.D.length === b.D.length
    )
  ) {
    return false;
  }
  for (let i = 0; i < a.D.length; i++) {
    if (a.D[i] !== b.D[i]) {
      return false;
    }
  }
  for (let i = 0; i < 9; i++) {
    if (a.K[i] !== b.K[i]) {
      return false;
    }
  }
  for (let i = 0; i < 9; i++) {
    if (a.R[i] !== b.R[i]) {
      return false;
    }
  }
  for (let i = 0; i < 12; i++) {
    if (a.P[i] !== b.P[i]) {
      return false;
    }
  }
  return true;
}

function multiplyScalar(vec: MutablePoint, scalar: number): void {
  vec.x *= scalar;
  vec.y *= scalar;
  vec.z *= scalar;
}

function normalizeRegionOfInterest(
  roi: PartialMessage<RegionOfInterest> | undefined,
): RegionOfInterest {
  if (!roi) {
    return { x_offset: 0, y_offset: 0, height: 0, width: 0, do_rectify: false };
  }
  return {
    x_offset: roi.x_offset ?? 0,
    y_offset: roi.y_offset ?? 0,
    height: roi.height ?? 0,
    width: roi.width ?? 0,
    do_rectify: roi.do_rectify ?? false,
  };
}

function normalizeCameraInfo(
  message: PartialMessage<IncomingCameraInfo> & PartialMessage<CameraCalibration>,
): CameraInfo {
  // Handle lowercase field names as well (ROS2 compatibility)
  const D = message.D ?? message.d;
  const K = message.K ?? message.k;
  const R = message.R ?? message.r;
  const P = message.P ?? message.p;

  const Dlen = D?.length ?? 0;
  const Klen = K?.length ?? 0;
  const Rlen = R?.length ?? 0;
  const Plen = P?.length ?? 0;

  return {
    header:
      "timestamp" in message
        ? { stamp: normalizeTime(message.timestamp), frame_id: message.frame_id ?? "" }
        : normalizeHeader(message.header),
    height: message.height ?? 0,
    width: message.width ?? 0,
    distortion_model: message.distortion_model ?? "",
    D: Dlen > 0 ? (D as number[]) : [],
    K: Klen === 9 ? (K as Matrix3) : [],
    R: Rlen === 9 ? (R as Matrix3) : [],
    P: Plen === 12 ? (P as Matrix3x4) : [],
    binning_x: message.binning_x ?? 0,
    binning_y: message.binning_y ?? 0,
    roi: normalizeRegionOfInterest(message.roi),
  };
}
