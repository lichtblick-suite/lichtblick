// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";
import { SettingsTreeAction, SettingsTreeFields, Topic } from "@foxglove/studio";

import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { PartialMessage, PartialMessageEvent, SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { makeRgba, rgbaGradient, rgbaToCssString, stringToRgba } from "../color";
import { vecEqual } from "../math";
import { normalizeHeader, normalizePose } from "../normalizeMessages";
import {
  PoseArray,
  POSE_ARRAY_DATATYPES,
  ColorRGBA,
  NAV_PATH_DATATYPES,
  Marker,
  NavPath,
  MarkerType,
  MarkerAction,
} from "../ros";
import {
  BaseSettings,
  fieldGradient,
  fieldLineWidth,
  fieldScaleVec3,
  fieldSize,
  PRECISION_DISTANCE,
} from "../settings";
import { makePose, Pose } from "../transforms";
import { AxisRenderable, AXIS_LENGTH } from "./AxisRenderable";
import { createArrowMarker } from "./Poses";
import { RenderableArrow } from "./markers/RenderableArrow";
import { RenderableLineStrip } from "./markers/RenderableLineStrip";

type GradientRgba = [ColorRGBA, ColorRGBA];
type Gradient = [string, string];
type DisplayType = "axis" | "arrow" | "line";

export type LayerSettingsPoseArray = BaseSettings & {
  type: DisplayType;
  axisScale: number;
  arrowScale: [number, number, number];
  lineWidth: number;
  gradient: Gradient;
};

const DEFAULT_TYPE: DisplayType = "axis";
const DEFAULT_AXIS_SCALE = AXIS_LENGTH;
const DEFAULT_ARROW_SCALE: THREE.Vector3Tuple = [1, 0.15, 0.15];
const DEFAULT_LINE_WIDTH = 0.2;
const DEFAULT_GRADIENT: GradientRgba = [
  { r: 124 / 255, g: 107 / 255, b: 1, a: 1 },
  { r: 124 / 255, g: 107 / 255, b: 1, a: 0.5 },
];

const MISMATCHED_FRAME_ID = "MISMATCHED_FRAME_ID";

const TIME_ZERO = { sec: 0, nsec: 0 };
const COLOR_WHITE = { r: 1, g: 1, b: 1, a: 1 };

const DEFAULT_GRADIENT_STR: Gradient = [
  rgbaToCssString(DEFAULT_GRADIENT[0]!),
  rgbaToCssString(DEFAULT_GRADIENT[1]!),
];

const DEFAULT_SETTINGS: LayerSettingsPoseArray = {
  visible: true,
  type: DEFAULT_TYPE,
  axisScale: DEFAULT_AXIS_SCALE,
  arrowScale: DEFAULT_ARROW_SCALE,
  lineWidth: DEFAULT_LINE_WIDTH,
  gradient: DEFAULT_GRADIENT_STR,
};

const TYPE_OPTIONS = [
  { label: "Axis", value: "axis" },
  { label: "Arrow", value: "arrow" },
  { label: "Line", value: "line" },
];

const tempColor1 = makeRgba();
const tempColor2 = makeRgba();
const tempColor3 = makeRgba();

export type PoseArrayUserData = BaseUserData & {
  settings: LayerSettingsPoseArray;
  topic: string;
  poseArrayMessage: PoseArray;
  axes: AxisRenderable[];
  arrows: RenderableArrow[];
  lineStrip?: RenderableLineStrip;
};

export class PoseArrayRenderable extends Renderable<PoseArrayUserData> {
  override dispose(): void {
    this.userData.axes.forEach((axis) => axis.dispose());
    this.userData.arrows.forEach((arrow) => arrow.dispose());
    this.userData.lineStrip?.dispose();
    super.dispose();
  }

  removeArrows(): void {
    for (const arrow of this.userData.arrows) {
      this.remove(arrow);
      arrow.dispose();
    }
    this.userData.arrows.length = 0;
  }

  removeAxes(): void {
    for (const axis of this.userData.axes) {
      this.remove(axis);
      axis.dispose();
    }
    this.userData.axes.length = 0;
  }

  removeLineStrip(): void {
    if (this.userData.lineStrip) {
      this.remove(this.userData.lineStrip);
      this.userData.lineStrip.dispose();
      this.userData.lineStrip = undefined;
    }
  }
}

export class PoseArrays extends SceneExtension<PoseArrayRenderable> {
  constructor(renderer: Renderer) {
    super("foxglove.PoseArrays", renderer);

    renderer.addDatatypeSubscriptions(POSE_ARRAY_DATATYPES, this.handlePoseArray);
    renderer.addDatatypeSubscriptions(NAV_PATH_DATATYPES, this.handleNavPath);
  }

  override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const topic of this.renderer.topics ?? []) {
      if (POSE_ARRAY_DATATYPES.has(topic.datatype)) {
        const config = (configTopics[topic.name] ?? {}) as Partial<LayerSettingsPoseArray>;
        const displayType = config.type ?? getDefaultType(topic);
        const { axisScale, lineWidth } = config;
        const arrowScale = config.arrowScale ?? DEFAULT_ARROW_SCALE;
        const gradient = config.gradient ?? DEFAULT_GRADIENT_STR;

        const fields: SettingsTreeFields = {
          type: { label: "Type", input: "select", options: TYPE_OPTIONS, value: displayType },
        };
        switch (displayType) {
          case "axis":
            fields["axisScale"] = fieldSize("Scale", axisScale, PRECISION_DISTANCE);
            break;
          case "arrow":
            fields["arrowScale"] = fieldScaleVec3("Scale", arrowScale);
            break;
          case "line":
            fields["lineWidth"] = fieldLineWidth("Line Width", lineWidth, DEFAULT_LINE_WIDTH);
            break;
        }

        // Axis does not currently support gradients. This could possibly be done with tinting
        if (displayType !== "axis") {
          fields["gradient"] = fieldGradient("Gradient", gradient);
        }

        entries.push({
          path: ["topics", topic.name],
          node: {
            label: topic.name,
            icon: NAV_PATH_DATATYPES.has(topic.datatype) ? "Timeline" : "Flag",
            fields,
            visible: config.visible ?? true,
            handler,
          },
        });
      }
    }
    return entries;
  }

  handleSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    if (action.action !== "update" || path.length !== 3) {
      return;
    }

    this.saveSetting(path, action.payload.value);

    // Update the renderable
    const topicName = path[1]!;
    const renderable = this.renderables.get(topicName);
    if (renderable) {
      const settings = this.renderer.config.topics[topicName] as
        | Partial<LayerSettingsPoseArray>
        | undefined;
      this._updatePoseArrayRenderable(
        renderable,
        renderable.userData.poseArrayMessage,
        renderable.userData.receiveTime,
        { ...renderable.userData.settings, ...settings },
      );
    }
  };

  handlePoseArray = (messageEvent: PartialMessageEvent<PoseArray>): void => {
    const poseArrayMessage = normalizePoseArray(messageEvent.message);
    const receiveTime = toNanoSec(messageEvent.receiveTime);
    this.addPoseArray(messageEvent.topic, poseArrayMessage, receiveTime);
  };

  handleNavPath = (messageEvent: PartialMessageEvent<NavPath>): void => {
    if (!validateNavPath(messageEvent, this.renderer)) {
      return;
    }

    const poseArrayMessage = normalizeNavPathToPoseArray(messageEvent.message);
    const receiveTime = toNanoSec(messageEvent.receiveTime);
    this.addPoseArray(messageEvent.topic, poseArrayMessage, receiveTime);
  };

  addPoseArray(topic: string, poseArrayMessage: PoseArray, receiveTime: bigint): void {
    let renderable = this.renderables.get(topic);
    if (!renderable) {
      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsPoseArray>
        | undefined;
      const defaultType = { type: getDefaultType(this.renderer.topicsByName?.get(topic)) };
      const settings = { ...DEFAULT_SETTINGS, ...defaultType, ...userSettings };

      renderable = new PoseArrayRenderable(topic, this.renderer, {
        receiveTime,
        messageTime: toNanoSec(poseArrayMessage.header.stamp),
        frameId: poseArrayMessage.header.frame_id,
        pose: makePose(),
        settingsPath: ["topics", topic],
        settings,
        topic,
        poseArrayMessage,
        axes: [],
        arrows: [],
      });

      this.add(renderable);
      this.renderables.set(topic, renderable);
    }

    this._updatePoseArrayRenderable(
      renderable,
      poseArrayMessage,
      receiveTime,
      renderable.userData.settings,
    );
  }

  _updatePoseArrayRenderable(
    renderable: PoseArrayRenderable,
    poseArrayMessage: PoseArray,
    receiveTime: bigint,
    settings: LayerSettingsPoseArray,
  ): void {
    renderable.userData.receiveTime = receiveTime;
    renderable.userData.messageTime = toNanoSec(poseArrayMessage.header.stamp);
    renderable.userData.frameId = poseArrayMessage.header.frame_id;
    renderable.userData.poseArrayMessage = poseArrayMessage;

    const { topic, settings: prevSettings } = renderable.userData;
    const axisOrArrowSettingsChanged =
      settings.type !== prevSettings.type ||
      settings.axisScale !== prevSettings.axisScale ||
      !vecEqual(settings.arrowScale, prevSettings.arrowScale) ||
      !vecEqual(settings.gradient, prevSettings.gradient) ||
      (renderable.userData.arrows.length === 0 && renderable.userData.axes.length === 0);

    renderable.userData.settings = settings;

    const colorStart = stringToRgba(tempColor1, settings.gradient[0]);
    const colorEnd = stringToRgba(tempColor2, settings.gradient[1]);

    if (axisOrArrowSettingsChanged) {
      switch (renderable.userData.settings.type) {
        case "axis":
          {
            renderable.removeArrows();
            renderable.removeLineStrip();

            // Create any AxisRenderables needed
            while (renderable.userData.axes.length < poseArrayMessage.poses.length) {
              const axis = new AxisRenderable(topic, this.renderer, {
                receiveTime: 0n,
                messageTime: 0n,
                frameId: "",
                pose: makePose(),
                settingsPath: [],
                settings: { visible: true },
              });
              renderable.userData.axes.push(axis);
              renderable.add(axis);
            }

            // Update the scale for each axis
            const scale = renderable.userData.settings.axisScale * (1 / AXIS_LENGTH);
            for (const axis of renderable.userData.axes) {
              axis.scale.set(scale, scale, scale);
            }
          }
          break;
        case "arrow":
          {
            renderable.removeAxes();
            renderable.removeLineStrip();

            for (let i = 0; i < poseArrayMessage.poses.length; i++) {
              // Update the scale and color for each arrow by regenerating a Marker
              const t = i / (poseArrayMessage.poses.length - 1);
              const color = rgbaGradient(tempColor3, colorStart, colorEnd, t);
              const arrowMarker = createArrowMarker(settings.arrowScale, color);

              // Create this RenderableArrow if needed
              if (i >= renderable.userData.arrows.length) {
                const arrow = new RenderableArrow(topic, arrowMarker, undefined, this.renderer);
                renderable.userData.arrows.push(arrow);
                renderable.add(arrow);
              }

              const arrow = renderable.userData.arrows[i]!;
              arrow.update(arrowMarker, undefined);
            }
          }
          break;
        case "line":
          {
            renderable.removeArrows();
            renderable.removeAxes();

            const lineStripMarker = createLineStripMarker(
              poseArrayMessage,
              settings.lineWidth,
              colorStart,
              colorEnd,
            );

            // Create a RenderableLineStrip if needed
            if (!renderable.userData.lineStrip) {
              const lineStrip = new RenderableLineStrip(
                topic,
                lineStripMarker,
                undefined,
                this.renderer,
              );
              renderable.userData.lineStrip = lineStrip;
              renderable.add(lineStrip);
            }

            renderable.userData.lineStrip.update(lineStripMarker, undefined);
          }
          break;
      }
    }

    // Update the pose for each pose renderable
    switch (settings.type) {
      case "axis":
        for (let i = 0; i < poseArrayMessage.poses.length; i++) {
          setRenderablePose(renderable.userData.axes[i]!, poseArrayMessage.poses[i]!);
        }
        break;
      case "arrow":
        for (let i = 0; i < poseArrayMessage.poses.length; i++) {
          setRenderablePose(renderable.userData.arrows[i]!, poseArrayMessage.poses[i]!);
        }
        break;
      case "line": {
        const lineStripMarker = createLineStripMarker(
          poseArrayMessage,
          settings.lineWidth,
          colorStart,
          colorEnd,
        );
        renderable.userData.lineStrip?.update(lineStripMarker, undefined);
        break;
      }
    }
  }

  _destroyArrows(renderable: PoseArrayRenderable): void {
    for (const arrow of renderable.userData.arrows) {
      renderable.remove(arrow);
      arrow.dispose();
    }
    renderable.userData.arrows.length = 0;
  }

  _destroyAxes(): void {}
}

function getDefaultType(topic: Topic | undefined): DisplayType {
  return topic != undefined && NAV_PATH_DATATYPES.has(topic.datatype) ? "line" : DEFAULT_TYPE;
}

function setRenderablePose(renderable: Renderable, pose: Pose): void {
  const p = pose.position;
  const q = pose.orientation;
  renderable.position.set(p.x, p.y, p.z);
  renderable.quaternion.set(q.x, q.y, q.z, q.w);
  renderable.updateMatrix();
}

function createLineStripMarker(
  message: PoseArray,
  lineWidth: number,
  colorStart: ColorRGBA,
  colorEnd: ColorRGBA,
): Marker {
  // Create a gradient of colors for the line strip
  const colors: ColorRGBA[] = [];
  for (let i = 0; i < message.poses.length; i++) {
    const t = i / (message.poses.length - 1);
    colors.push(rgbaGradient(makeRgba(), colorStart, colorEnd, t));
  }

  return {
    header: message.header,
    ns: "",
    id: 0,
    type: MarkerType.LINE_STRIP,
    action: MarkerAction.ADD,
    pose: makePose(),
    scale: { x: lineWidth, y: 1, z: 1 },
    color: COLOR_WHITE,
    lifetime: TIME_ZERO,
    frame_locked: true,
    points: message.poses.map((pose) => pose.position),
    colors,
    text: "",
    mesh_resource: "",
    mesh_use_embedded_materials: false,
  };
}

function normalizePoseArray(poseArray: PartialMessage<PoseArray>): PoseArray {
  return {
    header: normalizeHeader(poseArray.header),
    poses: poseArray.poses?.map((p) => normalizePose(p)) ?? [],
  };
}

function normalizeNavPathToPoseArray(navPath: PartialMessage<NavPath>): PoseArray {
  return {
    header: normalizeHeader(navPath.header),
    poses: navPath.poses?.map((p) => normalizePose(p.pose)) ?? [],
  };
}

function validateNavPath(messageEvent: PartialMessageEvent<NavPath>, renderer: Renderer): boolean {
  const { topic, message: navPath } = messageEvent;
  if (navPath.poses) {
    const baseFrameId = navPath.header?.frame_id;
    for (const pose of navPath.poses) {
      const curFrameId = pose.header?.frame_id;
      if (baseFrameId !== curFrameId) {
        renderer.settings.errors.addToTopic(
          topic,
          MISMATCHED_FRAME_ID,
          `Path poses must all have the same frame_id. "${baseFrameId}" != "${curFrameId}"`,
        );
        return false;
      }
    }
  }
  return true;
}
