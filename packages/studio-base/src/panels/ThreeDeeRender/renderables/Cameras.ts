// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import Logger from "@foxglove/log";
import { SettingsTreeFields } from "@foxglove/studio-base/components/SettingsTreeEditor/types";
import PinholeCameraModel from "@foxglove/studio-base/panels/Image/lib/PinholeCameraModel";
import { MutablePoint } from "@foxglove/studio-base/types/Messages";

import { Renderer } from "../Renderer";
import { makeRgba, rgbaToCssString, stringToRgba } from "../color";
import { CameraInfo, Marker, MarkerAction, MarkerType, Pose, rosTimeToNanoSec } from "../ros";
import { LayerSettingsCameraInfo, LayerType } from "../settings";
import { makePose } from "../transforms/geometry";
import { updatePose } from "../updatePose";
import { RenderableLineList } from "./markers/RenderableLineList";
import { missingTransformMessage, MISSING_TRANSFORM } from "./transforms";

const log = Logger.getLogger(__filename);

const DEFAULT_DISTANCE = 1;
const DEFAULT_WIDTH = 0.01;

const DEFAULT_COLOR = { r: 124 / 255, g: 107 / 255, b: 1, a: 1 };

const DEFAULT_COLOR_STR = rgbaToCssString(DEFAULT_COLOR);

const CAMERA_MODEL = "CameraModel";

const DEFAULT_SETTINGS: LayerSettingsCameraInfo = {
  visible: true,
  distance: DEFAULT_DISTANCE,
  width: DEFAULT_WIDTH,
  color: DEFAULT_COLOR_STR,
};

export type CameraInfoRenderable = THREE.Object3D & {
  userData: {
    topic: string;
    settings: LayerSettingsCameraInfo;
    cameraInfo: CameraInfo;
    cameraModel: PinholeCameraModel | undefined;
    pose: Pose;
    srcTime: bigint;
    lines: RenderableLineList | undefined;
  };
};

export class Cameras extends THREE.Object3D {
  renderer: Renderer;
  camerasByTopic = new Map<string, CameraInfoRenderable>();

  constructor(renderer: Renderer) {
    super();
    this.renderer = renderer;

    renderer.setSettingsNodeProvider(LayerType.CameraInfo, (topicConfig, _topic) => {
      const cur = topicConfig as Partial<LayerSettingsCameraInfo>;
      const color = cur.color ?? DEFAULT_COLOR_STR;

      // prettier-ignore
      const fields: SettingsTreeFields = {
        distance: { label: "Distance", input: "number", min: 0, value: cur.distance, placeholder: String(DEFAULT_DISTANCE), step: 0.1 },
        width: { label: "Line Width", input: "number", min: 0, value: cur.width, placeholder: String(DEFAULT_WIDTH), step: 0.005 },
        color: { label: "Color", input: "rgba", value: color },
      };

      return { icon: "Camera", fields };
    });
  }

  dispose(): void {
    for (const renderable of this.camerasByTopic.values()) {
      renderable.userData.lines?.dispose();
      renderable.userData.cameraModel = undefined;
      renderable.userData.lines = undefined;
    }
    this.children.length = 0;
    this.camerasByTopic.clear();
  }

  addCameraInfoMessage(topic: string, cameraInfo: CameraInfo): void {
    let renderable = this.camerasByTopic.get(topic);
    if (!renderable) {
      renderable = new THREE.Object3D() as CameraInfoRenderable;
      renderable.name = topic;
      renderable.userData.topic = topic;

      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsCameraInfo>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...userSettings };
      renderable.userData.settings = settings;
      renderable.userData.cameraInfo = cameraInfo;

      if (cameraInfo.P.length === 12) {
        try {
          renderable.userData.cameraModel = new PinholeCameraModel(cameraInfo);
        } catch (errUnk) {
          const err = errUnk as Error;
          this.renderer.layerErrors.addToTopic(topic, CAMERA_MODEL, err.message);
        }
      } else {
        this.renderer.layerErrors.addToTopic(
          topic,
          CAMERA_MODEL,
          `P has length ${cameraInfo.P.length}, not a 3x4 matrix`,
        );
      }

      renderable.userData.srcTime = rosTimeToNanoSec(cameraInfo.header.stamp);
      renderable.userData.pose = makePose();

      this.add(renderable);
      this.camerasByTopic.set(topic, renderable);
    }

    this._updateCameraInfoRenderable(renderable, cameraInfo, renderable.userData.settings);
  }

  setTopicSettings(topic: string, settings: Partial<LayerSettingsCameraInfo>): void {
    const renderable = this.camerasByTopic.get(topic);
    if (renderable) {
      this._updateCameraInfoRenderable(renderable, renderable.userData.cameraInfo, settings);
    }
  }

  startFrame(currentTime: bigint): void {
    const renderFrameId = this.renderer.renderFrameId;
    const fixedFrameId = this.renderer.fixedFrameId;
    if (renderFrameId == undefined || fixedFrameId == undefined) {
      this.visible = false;
      return;
    }
    this.visible = true;

    for (const renderable of this.camerasByTopic.values()) {
      renderable.visible = renderable.userData.settings.visible;
      if (!renderable.visible) {
        this.renderer.layerErrors.clearTopic(renderable.userData.topic);
        continue;
      }

      const srcTime = currentTime;
      const frameId = renderable.userData.cameraInfo.header.frame_id;
      const updated = updatePose(
        renderable,
        this.renderer.transformTree,
        renderFrameId,
        fixedFrameId,
        frameId,
        currentTime,
        srcTime,
      );
      if (!updated) {
        const message = missingTransformMessage(renderFrameId, fixedFrameId, frameId);
        this.renderer.layerErrors.addToTopic(renderable.userData.topic, MISSING_TRANSFORM, message);
      }
    }
  }

  _updateCameraInfoRenderable(
    renderable: CameraInfoRenderable,
    cameraInfo: CameraInfo,
    settings: Partial<LayerSettingsCameraInfo>,
  ): void {
    const prevSettings = renderable.userData.settings;
    const newSettings = { ...prevSettings, ...settings };
    const settingsEqual =
      newSettings.color === prevSettings.color &&
      newSettings.distance === prevSettings.distance &&
      newSettings.width === prevSettings.width;
    const topic = renderable.userData.topic;

    renderable.userData.settings = newSettings;

    // If the CameraInfo message contents changed, rebuild cameraModel
    const dataEqual = cameraInfosEqual(renderable.userData.cameraInfo, cameraInfo);
    if (!dataEqual) {
      log.warn(`CameraInfo changed on topic "${topic}", updating rectification model`);
      renderable.userData.cameraInfo = cameraInfo;

      if (cameraInfo.P.length === 12) {
        try {
          renderable.userData.cameraModel = new PinholeCameraModel(cameraInfo);
        } catch (errUnk) {
          const err = errUnk as Error;
          this.renderer.layerErrors.addToTopic(topic, CAMERA_MODEL, err.message);
          renderable.userData.cameraModel = undefined;
          if (renderable.userData.lines) {
            renderable.remove(renderable.userData.lines);
            renderable.userData.lines.dispose();
            renderable.userData.lines = undefined;
          }
        }
      } else {
        this.renderer.layerErrors.addToTopic(
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
      this.renderer.layerErrors.removeFromTopic(topic, CAMERA_MODEL);

      // Synthesize a LINE_LIST marker to instantiate or update a RenderableLineList
      const marker = createLineListMarker(
        cameraInfo,
        renderable.userData.cameraModel,
        renderable.userData.settings,
      );
      if (!renderable.userData.lines) {
        renderable.userData.lines = new RenderableLineList(topic, marker, this.renderer);
        renderable.add(renderable.userData.lines);
      } else {
        renderable.userData.lines.update(marker);
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
    lifetime: { sec: 0, nsec: 0 },
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

function cameraInfosEqual(a: CameraInfo, b: CameraInfo): boolean {
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
