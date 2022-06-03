// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { SettingsTreeFields } from "@foxglove/studio-base/components/SettingsTreeEditor/types";

import { Renderer } from "../Renderer";
import { makeRgba, rgbaToCssString, stringToRgba } from "../color";
import {
  Pose,
  rosTimeToNanoSec,
  Marker,
  PoseWithCovarianceStamped,
  PoseStamped,
  POSE_WITH_COVARIANCE_STAMPED_DATATYPES,
  MarkerAction,
  MarkerType,
} from "../ros";
import { LayerSettingsPose, LayerType } from "../settings";
import { makePose } from "../transforms/geometry";
import { updatePose } from "../updatePose";
import { RenderableArrow } from "./markers/RenderableArrow";
import { RenderableSphere } from "./markers/RenderableSphere";
import { missingTransformMessage, MISSING_TRANSFORM } from "./transforms";

const DEFAULT_SCALE: THREE.Vector3Tuple = [1, 0.15, 0.15];
const DEFAULT_COLOR = { r: 124 / 255, g: 107 / 255, b: 1, a: 1 };
const DEFAULT_COVARIANCE_COLOR = { r: 198 / 255, g: 107 / 255, b: 1, a: 0.25 };

const DEFAULT_COLOR_STR = rgbaToCssString(DEFAULT_COLOR);
const DEFAULT_COVARIANCE_COLOR_STR = rgbaToCssString(DEFAULT_COVARIANCE_COLOR);

const DEFAULT_SETTINGS: LayerSettingsPose = {
  visible: true,
  scale: DEFAULT_SCALE,
  color: DEFAULT_COLOR_STR,
  showCovariance: true,
  covarianceColor: DEFAULT_COVARIANCE_COLOR_STR,
};

type PoseRenderable = THREE.Object3D & {
  userData: {
    topic: string;
    settings: LayerSettingsPose;
    poseMessage: PoseStamped | PoseWithCovarianceStamped;
    pose: Pose;
    srcTime: bigint;
    arrow: RenderableArrow;
    sphere?: RenderableSphere;
  };
};

export class Poses extends THREE.Object3D {
  renderer: Renderer;
  posesByTopic = new Map<string, PoseRenderable>();

  constructor(renderer: Renderer) {
    super();
    this.renderer = renderer;

    renderer.setSettingsNodeProvider(LayerType.Pose, (topicConfig, topic) => {
      const cur = topicConfig as Partial<LayerSettingsPose>;
      const scale = cur.scale ?? DEFAULT_SCALE;
      const color = cur.color ?? DEFAULT_COLOR_STR;

      const fields: SettingsTreeFields = {
        scale: { label: "Scale", input: "vec3", labels: ["X", "Y", "Z"], value: scale },
        color: { label: "Color", input: "rgba", value: color },
      };

      if (POSE_WITH_COVARIANCE_STAMPED_DATATYPES.has(topic.datatype)) {
        const showCovariance = cur.showCovariance ?? true;
        const covarianceColor = cur.covarianceColor ?? DEFAULT_COVARIANCE_COLOR_STR;

        fields["showCovariance"] = { label: "Covariance", input: "boolean", value: showCovariance };
        if (showCovariance) {
          fields["covarianceColor"] = {
            label: "Covariance Color",
            input: "rgba",
            value: covarianceColor,
          };
        }
      }

      return { icon: "Flag", fields };
    });
  }

  dispose(): void {
    for (const renderable of this.posesByTopic.values()) {
      renderable.userData.arrow.dispose();
      renderable.userData.sphere?.dispose();
    }
    this.children.length = 0;
    this.posesByTopic.clear();
  }

  addPoseMessage(topic: string, poseMessage: PoseStamped | PoseWithCovarianceStamped): void {
    let renderable = this.posesByTopic.get(topic);
    if (!renderable) {
      renderable = new THREE.Object3D() as PoseRenderable;
      renderable.name = topic;
      renderable.userData.topic = topic;

      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsPose>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...userSettings };
      renderable.userData.settings = settings;

      renderable.userData.poseMessage = poseMessage;
      renderable.userData.srcTime = rosTimeToNanoSec(poseMessage.header.stamp);

      // Synthesize an arrow marker to instantiate a RenderableArrow
      const arrowMarker = createArrowMarker(poseMessage, settings);
      renderable.userData.arrow = new RenderableArrow(topic, arrowMarker, this.renderer);
      renderable.add(renderable.userData.arrow);

      if ("covariance" in poseMessage.pose) {
        renderable.userData.pose = poseMessage.pose.pose;

        const poseWithCovariance = poseMessage as PoseWithCovarianceStamped;
        const sphereMarker = createSphereMarker(poseWithCovariance, settings);
        if (sphereMarker) {
          renderable.userData.sphere = new RenderableSphere(topic, sphereMarker, this.renderer);
          renderable.add(renderable.userData.sphere);
        }
      } else {
        renderable.userData.pose = poseMessage.pose;
      }

      this.add(renderable);
      this.posesByTopic.set(topic, renderable);
    }

    this._updatePoseRenderable(renderable, poseMessage);
  }

  setTopicSettings(topic: string, settings: Partial<LayerSettingsPose>): void {
    const renderable = this.posesByTopic.get(topic);
    if (renderable) {
      renderable.userData.settings = { ...renderable.userData.settings, ...settings };
      this._updatePoseRenderable(renderable, renderable.userData.poseMessage);
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

    for (const renderable of this.posesByTopic.values()) {
      renderable.visible = renderable.userData.settings.visible;
      if (!renderable.visible) {
        this.renderer.layerErrors.clearTopic(renderable.userData.topic);
        continue;
      }

      if (renderable.userData.sphere) {
        renderable.userData.sphere.visible = renderable.userData.settings.showCovariance;
      }

      const srcTime = currentTime;
      const frameId = renderable.userData.poseMessage.header.frame_id;
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

  _updatePoseRenderable(
    renderable: PoseRenderable,
    poseMessage: PoseStamped | PoseWithCovarianceStamped,
  ): void {
    const arrowMarker = createArrowMarker(poseMessage, renderable.userData.settings);
    renderable.userData.arrow.update(arrowMarker);

    if ("covariance" in poseMessage.pose) {
      const poseWithCovariance = poseMessage as PoseWithCovarianceStamped;
      const sphereMarker = createSphereMarker(poseWithCovariance, renderable.userData.settings);
      if (sphereMarker) {
        if (!renderable.userData.sphere) {
          renderable.userData.sphere = new RenderableSphere(
            renderable.userData.topic,
            sphereMarker,
            this.renderer,
          );
        }
        renderable.userData.sphere.visible = true;
        renderable.userData.sphere.update(sphereMarker);
      } else if (renderable.userData.sphere) {
        renderable.userData.sphere.visible = false;
      }
    }
  }
}

function createArrowMarker(
  poseMessage: PoseStamped | PoseWithCovarianceStamped,
  settings: LayerSettingsPose,
): Marker {
  return {
    header: poseMessage.header,
    ns: "",
    id: 0,
    type: MarkerType.ARROW,
    action: MarkerAction.ADD,
    pose: makePose(),
    scale: { x: settings.scale[0], y: settings.scale[1], z: settings.scale[2] },
    color: stringToRgba(makeRgba(), settings.color),
    lifetime: { sec: 0, nsec: 0 },
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
    lifetime: { sec: 0, nsec: 0 },
    frame_locked: true,
    points: [],
    colors: [],
    text: "",
    mesh_resource: "",
    mesh_use_embedded_materials: false,
  };
}
