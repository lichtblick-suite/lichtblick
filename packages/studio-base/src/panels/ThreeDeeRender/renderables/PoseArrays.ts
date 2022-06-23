// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";
import { SettingsTreeAction, SettingsTreeFields } from "@foxglove/studio";

import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { PartialMessage, PartialMessageEvent, SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { makeRgba, rgbaGradient, rgbaToCssString, stringToRgba } from "../color";
import { vecEqual } from "../math";
import { normalizeHeader, normalizePose } from "../normalizeMessages";
import { PoseArray, POSE_ARRAY_DATATYPES, ColorRGBA } from "../ros";
import { BaseSettings, PRECISION_DISTANCE } from "../settings";
import { makePose, Pose } from "../transforms";
import { AxisRenderable, AXIS_LENGTH } from "./AxisRenderable";
import { createArrowMarker } from "./Poses";
import { RenderableArrow } from "./markers/RenderableArrow";

type GradientRgba = [ColorRGBA, ColorRGBA];
type Gradient = [string, string];
type DisplayType = "axis" | "arrow";

export type LayerSettingsPoseArray = BaseSettings & {
  type: DisplayType;
  axisScale: number;
  arrowScale: [number, number, number];
  gradient: Gradient;
};

const DEFAULT_TYPE: DisplayType = "axis";
const DEFAULT_AXIS_SCALE = AXIS_LENGTH;
const DEFAULT_ARROW_SCALE: THREE.Vector3Tuple = [1, 0.15, 0.15];
const DEFAULT_GRADIENT: GradientRgba = [
  { r: 124 / 255, g: 107 / 255, b: 1, a: 1 },
  { r: 124 / 255, g: 107 / 255, b: 1, a: 0.5 },
];

const DEFAULT_GRADIENT_STR: Gradient = [
  rgbaToCssString(DEFAULT_GRADIENT[0]!),
  rgbaToCssString(DEFAULT_GRADIENT[1]!),
];

const DEFAULT_SETTINGS: LayerSettingsPoseArray = {
  visible: true,
  type: DEFAULT_TYPE,
  axisScale: DEFAULT_AXIS_SCALE,
  arrowScale: DEFAULT_ARROW_SCALE,
  gradient: DEFAULT_GRADIENT_STR,
};

const TYPE_OPTIONS = [
  { label: "Axis", value: "axis" },
  { label: "Arrow", value: "arrow" },
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
};

export class PoseArrayRenderable extends Renderable<PoseArrayUserData> {
  override dispose(): void {
    this.userData.axes.forEach((axis) => axis.dispose());
    this.userData.arrows.forEach((arrow) => arrow.dispose());
    super.dispose();
  }
}

export class PoseArrays extends SceneExtension<PoseArrayRenderable> {
  constructor(renderer: Renderer) {
    super("foxglove.PoseArrays", renderer);

    renderer.addDatatypeSubscriptions(POSE_ARRAY_DATATYPES, this.handlePoseArray);
  }

  override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const topic of this.renderer.topics ?? []) {
      if (POSE_ARRAY_DATATYPES.has(topic.datatype)) {
        const config = (configTopics[topic.name] ?? {}) as Partial<LayerSettingsPoseArray>;
        const type = config.type ?? DEFAULT_TYPE;

        const fields: SettingsTreeFields = {
          type: { label: "Type", input: "select", options: TYPE_OPTIONS, value: type },
        };
        if (type === "axis") {
          fields["axisScale"] = {
            label: "Scale",
            input: "number",
            min: 0,
            step: 0.5,
            precision: PRECISION_DISTANCE,
            value: config.axisScale ?? DEFAULT_AXIS_SCALE,
          };
        } else {
          fields["arrowScale"] = {
            label: "Scale",
            input: "vec3",
            labels: ["X", "Y", "Z"],
            step: 0.5,
            precision: PRECISION_DISTANCE,
            value: config.arrowScale ?? DEFAULT_ARROW_SCALE,
          };
          fields["gradient"] = {
            label: "Gradient",
            input: "gradient",
            value: config.gradient ?? DEFAULT_GRADIENT_STR,
          };
        }

        entries.push({
          path: ["topics", topic.name],
          node: {
            label: topic.name,
            icon: "Flag",
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

  addPoseArray(topic: string, poseArrayMessage: PoseArray, receiveTime: bigint): void {
    let renderable = this.renderables.get(topic);
    if (!renderable) {
      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsPoseArray>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...userSettings };

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

    if (axisOrArrowSettingsChanged) {
      if (renderable.userData.settings.type === "axis") {
        // Destroy any existing arrows
        for (const arrow of renderable.userData.arrows) {
          renderable.remove(arrow);
          arrow.dispose();
        }
        renderable.userData.arrows.length = 0;

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
      } else {
        // Destroy any existing axes
        for (const axis of renderable.userData.axes) {
          renderable.remove(axis);
          axis.dispose();
        }
        renderable.userData.axes.length = 0;

        const colorStart = stringToRgba(tempColor1, renderable.userData.settings.gradient[0]);
        const colorEnd = stringToRgba(tempColor2, renderable.userData.settings.gradient[1]);

        for (let i = 0; i < poseArrayMessage.poses.length; i++) {
          // Update the scale and color for each arrow by regenerating a Marker
          const t = i / (poseArrayMessage.poses.length - 1);
          const color = rgbaGradient(tempColor3, colorStart, colorEnd, t);
          const arrowMarker = createArrowMarker(settings.arrowScale, color);

          if (i >= renderable.userData.arrows.length) {
            const arrow = new RenderableArrow(topic, arrowMarker, undefined, this.renderer);
            renderable.userData.arrows.push(arrow);
            renderable.add(arrow);
          }

          const arrow = renderable.userData.arrows[i]!;
          arrow.update(arrowMarker, undefined);
        }
      }
    }

    // Update the pose for each pose renderable
    if (settings.type === "axis") {
      for (let i = 0; i < poseArrayMessage.poses.length; i++) {
        setRenderablePose(renderable.userData.axes[i]!, poseArrayMessage.poses[i]!);
      }
    } else {
      for (let i = 0; i < poseArrayMessage.poses.length; i++) {
        setRenderablePose(renderable.userData.arrows[i]!, poseArrayMessage.poses[i]!);
      }
    }
  }
}

function setRenderablePose(renderable: Renderable, pose: Pose): void {
  const p = pose.position;
  const q = pose.orientation;
  renderable.position.set(p.x, p.y, p.z);
  renderable.quaternion.set(q.x, q.y, q.z, q.w);
  renderable.updateMatrix();
}

function normalizePoseArray(pose: PartialMessage<PoseArray>): PoseArray {
  return {
    header: normalizeHeader(pose.header),
    poses: pose.poses?.map((p) => normalizePose(p)) ?? [],
  };
}
