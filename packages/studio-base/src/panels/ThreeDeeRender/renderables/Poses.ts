// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";
import { PoseInFrame } from "@foxglove/schemas";
import { SettingsTreeAction, SettingsTreeFields } from "@foxglove/studio";
import type { RosValue } from "@foxglove/studio-base/players/types";

import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { PartialMessage, PartialMessageEvent, SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { makeRgba, rgbaToCssString, stringToRgba } from "../color";
import { POSE_IN_FRAME_DATATYPES } from "../foxglove";
import { vecEqual } from "../math";
import {
  normalizeHeader,
  normalizeMatrix6,
  normalizePose,
  normalizeTime,
} from "../normalizeMessages";
import {
  Marker,
  PoseWithCovarianceStamped,
  PoseStamped,
  POSE_WITH_COVARIANCE_STAMPED_DATATYPES,
  MarkerAction,
  MarkerType,
  TIME_ZERO,
  POSE_STAMPED_DATATYPES,
  PoseWithCovariance,
  ColorRGBA,
} from "../ros";
import { BaseSettings, PRECISION_DISTANCE } from "../settings";
import { makePose } from "../transforms";
import { Axis, AXIS_LENGTH } from "./Axis";
import { RenderableArrow } from "./markers/RenderableArrow";
import { RenderableSphere } from "./markers/RenderableSphere";

type DisplayType = "axis" | "arrow";

export type LayerSettingsPose = BaseSettings & {
  type: DisplayType;
  axisScale: number;
  arrowScale: [number, number, number];
  color: string;
  showCovariance: boolean;
  covarianceColor: string;
};

const DEFAULT_TYPE: DisplayType = "axis";
const DEFAULT_AXIS_SCALE = AXIS_LENGTH;
const DEFAULT_ARROW_SCALE: THREE.Vector3Tuple = [1, 0.15, 0.15];
const DEFAULT_COLOR = { r: 124 / 255, g: 107 / 255, b: 1, a: 1 };
const DEFAULT_SHOW_COVARIANCE = true;
const DEFAULT_COVARIANCE_COLOR = { r: 198 / 255, g: 107 / 255, b: 1, a: 0.25 };

const DEFAULT_COLOR_STR = rgbaToCssString(DEFAULT_COLOR);
const DEFAULT_COVARIANCE_COLOR_STR = rgbaToCssString(DEFAULT_COVARIANCE_COLOR);

const DEFAULT_SETTINGS: LayerSettingsPose = {
  type: DEFAULT_TYPE,
  visible: false,
  axisScale: DEFAULT_AXIS_SCALE,
  arrowScale: DEFAULT_ARROW_SCALE,
  color: DEFAULT_COLOR_STR,
  showCovariance: DEFAULT_SHOW_COVARIANCE,
  covarianceColor: DEFAULT_COVARIANCE_COLOR_STR,
};

const TYPE_OPTIONS = [
  { label: "Axis", value: "axis" },
  { label: "Arrow", value: "arrow" },
];

export type PoseUserData = BaseUserData & {
  settings: LayerSettingsPose;
  topic: string;
  poseMessage: PoseStamped | PoseWithCovarianceStamped;
  originalMessage: Record<string, RosValue>;
  axis?: Axis;
  arrow?: RenderableArrow;
  sphere?: RenderableSphere;
};

export class PoseRenderable extends Renderable<PoseUserData> {
  public override dispose(): void {
    this.userData.axis?.dispose();
    this.userData.arrow?.dispose();
    this.userData.sphere?.dispose();
    super.dispose();
  }

  public override details(): Record<string, RosValue> {
    return this.userData.originalMessage;
  }
}

export class Poses extends SceneExtension<PoseRenderable> {
  public constructor(renderer: Renderer) {
    super("foxglove.Poses", renderer);

    renderer.addDatatypeSubscriptions(POSE_STAMPED_DATATYPES, this.handlePoseStamped);
    renderer.addDatatypeSubscriptions(POSE_IN_FRAME_DATATYPES, this.handlePoseInFrame);
    renderer.addDatatypeSubscriptions(
      POSE_WITH_COVARIANCE_STAMPED_DATATYPES,
      this.handlePoseWithCovariance,
    );
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const topic of this.renderer.topics ?? []) {
      const isPoseStamped = POSE_STAMPED_DATATYPES.has(topic.datatype);
      const isPoseInFrame = POSE_IN_FRAME_DATATYPES.has(topic.datatype);
      const isPoseWithCovarianceStamped = isPoseStamped
        ? false
        : POSE_WITH_COVARIANCE_STAMPED_DATATYPES.has(topic.datatype);
      if (isPoseStamped || isPoseWithCovarianceStamped || isPoseInFrame) {
        const config = (configTopics[topic.name] ?? {}) as Partial<LayerSettingsPose>;
        const type = config.type ?? DEFAULT_TYPE;

        const fields: SettingsTreeFields = {
          type: { label: "Type", input: "select", options: TYPE_OPTIONS, value: type },
        };
        if (type === "axis") {
          fields["axisScale"] = {
            label: "Scale",
            input: "number",
            step: 0.5,
            min: 0,
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
          fields["color"] = {
            label: "Color",
            input: "rgba",
            value: config.color ?? DEFAULT_COLOR_STR,
          };
        }

        if (isPoseWithCovarianceStamped) {
          const showCovariance = config.showCovariance ?? DEFAULT_SHOW_COVARIANCE;
          const covarianceColor = config.covarianceColor ?? DEFAULT_COVARIANCE_COLOR_STR;

          fields["showCovariance"] = {
            label: "Covariance",
            input: "boolean",
            value: showCovariance,
          };
          if (showCovariance) {
            fields["covarianceColor"] = {
              label: "Covariance Color",
              input: "rgba",
              value: covarianceColor,
            };
          }
        }

        entries.push({
          path: ["topics", topic.name],
          node: {
            label: topic.name,
            icon: "Flag",
            fields,
            visible: config.visible ?? DEFAULT_SETTINGS.visible,
            order: topic.name.toLocaleLowerCase(),
            handler,
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
      const settings = this.renderer.config.topics[topicName] as
        | Partial<LayerSettingsPose>
        | undefined;
      this._updatePoseRenderable(
        renderable,
        renderable.userData.poseMessage,
        renderable.userData.originalMessage,
        renderable.userData.receiveTime,
        { ...DEFAULT_SETTINGS, ...settings },
      );
    }
  };

  private handlePoseStamped = (messageEvent: PartialMessageEvent<PoseStamped>): void => {
    const poseMessage = normalizePoseStamped(messageEvent.message);
    const receiveTime = toNanoSec(messageEvent.receiveTime);
    this.addPose(messageEvent.topic, poseMessage, messageEvent.message, receiveTime);
  };

  private handlePoseInFrame = (messageEvent: PartialMessageEvent<PoseInFrame>): void => {
    const poseMessage = normalizePoseInFrameToPoseStamped(messageEvent.message);
    const receiveTime = toNanoSec(messageEvent.receiveTime);
    this.addPose(messageEvent.topic, poseMessage, messageEvent.message, receiveTime);
  };

  private handlePoseWithCovariance = (
    messageEvent: PartialMessageEvent<PoseWithCovarianceStamped>,
  ): void => {
    const poseMessage = normalizePoseWithCovarianceStamped(messageEvent.message);
    const receiveTime = toNanoSec(messageEvent.receiveTime);
    this.addPose(messageEvent.topic, poseMessage, messageEvent.message, receiveTime);
  };

  private addPose(
    topic: string,
    poseMessage: PoseStamped | PoseWithCovarianceStamped,
    originalMessage: Record<string, RosValue>,
    receiveTime: bigint,
  ): void {
    let renderable = this.renderables.get(topic);
    if (!renderable) {
      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsPose>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...userSettings };

      renderable = new PoseRenderable(topic, this.renderer, {
        receiveTime,
        messageTime: toNanoSec(poseMessage.header.stamp),
        frameId: this.renderer.normalizeFrameId(poseMessage.header.frame_id),
        pose: makePose(),
        settingsPath: ["topics", topic],
        settings,
        topic,
        poseMessage,
        originalMessage,
        axis: undefined,
        arrow: undefined,
        sphere: undefined,
      });

      this.add(renderable);
      this.renderables.set(topic, renderable);
    }

    this._updatePoseRenderable(
      renderable,
      poseMessage,
      originalMessage,
      receiveTime,
      renderable.userData.settings,
    );
  }

  private _updatePoseRenderable(
    renderable: PoseRenderable,
    poseMessage: PoseStamped | PoseWithCovarianceStamped,
    originalMessage: Record<string, RosValue>,
    receiveTime: bigint,
    settings: LayerSettingsPose,
  ): void {
    renderable.userData.receiveTime = receiveTime;
    renderable.userData.messageTime = toNanoSec(poseMessage.header.stamp);
    renderable.userData.frameId = this.renderer.normalizeFrameId(poseMessage.header.frame_id);
    renderable.userData.poseMessage = poseMessage;
    renderable.userData.originalMessage = originalMessage;

    // Default the covariance sphere to hidden. If showCovariance is set and a valid covariance
    // matrix is present, it will be shown
    if (renderable.userData.sphere) {
      renderable.userData.sphere.visible = false;
    }

    const { topic, settings: prevSettings } = renderable.userData;
    const axisOrArrowSettingsChanged =
      settings.type !== prevSettings.type ||
      settings.axisScale !== prevSettings.axisScale ||
      !vecEqual(settings.arrowScale, prevSettings.arrowScale) ||
      settings.color !== prevSettings.color ||
      (!renderable.userData.arrow && !renderable.userData.axis);

    renderable.userData.settings = settings;

    if (axisOrArrowSettingsChanged) {
      if (renderable.userData.settings.type === "axis") {
        if (renderable.userData.arrow) {
          renderable.remove(renderable.userData.arrow);
          renderable.userData.arrow.dispose();
          renderable.userData.arrow = undefined;
        }

        // Create an AxisRenderable if needed
        if (!renderable.userData.axis) {
          const axis = new Axis(topic, this.renderer);
          renderable.userData.axis = axis;
          renderable.add(axis);
        }

        const scale = renderable.userData.settings.axisScale * (1 / AXIS_LENGTH);
        renderable.userData.axis.scale.set(scale, scale, scale);
      } else {
        if (renderable.userData.axis) {
          renderable.remove(renderable.userData.axis);
          renderable.userData.axis.dispose();
          renderable.userData.axis = undefined;
        }

        const color = stringToRgba(makeRgba(), settings.color);
        const arrowMarker = createArrowMarker(settings.arrowScale, color);

        // Create a RenderableArrow if needed
        if (!renderable.userData.arrow) {
          const arrow = new RenderableArrow(topic, arrowMarker, undefined, this.renderer);
          renderable.userData.arrow = arrow;
          renderable.add(arrow);
        }

        renderable.userData.arrow.update(arrowMarker, undefined);
      }
    }

    if ("covariance" in poseMessage.pose) {
      renderable.userData.pose = poseMessage.pose.pose;

      const poseWithCovariance = poseMessage as PoseWithCovarianceStamped;
      const sphereMarker = createSphereMarker(poseWithCovariance, renderable.userData.settings);
      if (sphereMarker) {
        if (!renderable.userData.sphere) {
          renderable.userData.sphere = new RenderableSphere(
            renderable.userData.topic,
            sphereMarker,
            undefined,
            this.renderer,
          );
          renderable.add(renderable.userData.sphere);
        }
        renderable.userData.sphere.visible = renderable.userData.settings.showCovariance;
        renderable.userData.sphere.update(sphereMarker, undefined);
      } else if (renderable.userData.sphere) {
        renderable.userData.sphere.visible = false;
      }
    } else {
      renderable.userData.pose = poseMessage.pose;
    }
  }
}

export function createArrowMarker(arrowScale: [number, number, number], color: ColorRGBA): Marker {
  const [x, y, z] = arrowScale;
  return {
    header: { frame_id: "", stamp: { sec: 0, nsec: 0 } },
    ns: "",
    id: 0,
    type: MarkerType.ARROW,
    action: MarkerAction.ADD,
    pose: makePose(),
    scale: { x, y, z },
    color,
    lifetime: TIME_ZERO,
    frame_locked: true,
    points: [],
    colors: [],
    text: "",
    mesh_resource: "",
    mesh_use_embedded_materials: false,
  };
}

function createSphereMarker(
  poseMessage: PoseWithCovarianceStamped,
  settings: LayerSettingsPose,
): Marker | undefined {
  // Covariance is a 6x6 matrix for position and rotation (XYZ, RPY)
  // We currently only visualize position variance so extract the upper-left
  // 3x1 diagonal
  // [X, -, -, -, -, -]
  // [-, Y, -, -, -, -]
  // [-, -, Z, -, -, -]
  // [-, -, -, -, -, -]
  // [-, -, -, -, -, -]
  // [-, -, -, -, -, -]
  const K = poseMessage.pose.covariance;
  const scale = { x: Math.sqrt(K[0]), y: Math.sqrt(K[7]), z: Math.sqrt(K[14]) };

  return {
    header: poseMessage.header,
    ns: "",
    id: 1,
    type: MarkerType.SPHERE,
    action: MarkerAction.ADD,
    pose: makePose(),
    scale,
    color: stringToRgba(makeRgba(), settings.covarianceColor),
    lifetime: TIME_ZERO,
    frame_locked: true,
    points: [],
    colors: [],
    text: "",
    mesh_resource: "",
    mesh_use_embedded_materials: false,
  };
}

export function normalizePoseStamped(pose: PartialMessage<PoseStamped>): PoseStamped {
  return {
    header: normalizeHeader(pose.header),
    pose: normalizePose(pose.pose),
  };
}

function normalizePoseInFrameToPoseStamped(pose: PartialMessage<PoseInFrame>): PoseStamped {
  return {
    header: { stamp: normalizeTime(pose.timestamp), frame_id: pose.frame_id ?? "" },
    pose: normalizePose(pose.pose),
  };
}

function normalizePoseWithCovariance(
  pose: PartialMessage<PoseWithCovariance> | undefined,
): PoseWithCovariance {
  const covariance = normalizeMatrix6(pose?.covariance as number[] | undefined);
  return { pose: normalizePose(pose?.pose), covariance };
}

function normalizePoseWithCovarianceStamped(
  message: PartialMessage<PoseWithCovarianceStamped>,
): PoseWithCovarianceStamped {
  return {
    header: normalizeHeader(message.header),
    pose: normalizePoseWithCovariance(message.pose),
  };
}
