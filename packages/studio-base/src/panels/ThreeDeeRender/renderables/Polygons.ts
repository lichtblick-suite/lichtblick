// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";
import { SettingsTreeFields } from "@foxglove/studio-base/components/SettingsTreeEditor/types";

import { Renderer } from "../Renderer";
import { makeRgba, rgbaToCssString, stringToRgba } from "../color";
import { Marker, MarkerAction, MarkerType, PolygonStamped, Pose, TIME_ZERO } from "../ros";
import { LayerSettingsPolygon, LayerType } from "../settings";
import { makePose } from "../transforms/geometry";
import { updatePose } from "../updatePose";
import { RenderableLineStrip } from "./markers/RenderableLineStrip";
import { missingTransformMessage, MISSING_TRANSFORM } from "./transforms";

const DEFAULT_COLOR = { r: 124 / 255, g: 107 / 255, b: 1, a: 1 };
const DEFAULT_LINE_WIDTH = 0.1;

const DEFAULT_COLOR_STR = rgbaToCssString(DEFAULT_COLOR);

const DEFAULT_SETTINGS: LayerSettingsPolygon = {
  visible: true,
  lineWidth: DEFAULT_LINE_WIDTH,
  color: DEFAULT_COLOR_STR,
};

export type PolygonRenderable = Omit<THREE.Object3D, "userData"> & {
  userData: {
    topic: string;
    settings: LayerSettingsPolygon;
    polygonStamped: PolygonStamped;
    pose: Pose;
    srcTime: bigint;
    lines: RenderableLineStrip | undefined;
  };
};

export class Polygons extends THREE.Object3D {
  renderer: Renderer;
  polygonsByTopic = new Map<string, PolygonRenderable>();

  constructor(renderer: Renderer) {
    super();
    this.renderer = renderer;

    renderer.setSettingsNodeProvider(LayerType.Polygon, (topicConfig, _topic) => {
      const cur = topicConfig as Partial<LayerSettingsPolygon>;
      const color = cur.color ?? DEFAULT_COLOR_STR;

      // prettier-ignore
      const fields: SettingsTreeFields = {
        lineWidth: { label: "Line Width", input: "number", min: 0, value: cur.lineWidth, placeholder: String(DEFAULT_LINE_WIDTH), step: 0.005 },
        color: { label: "Color", input: "rgba", value: color },
      };

      return { icon: "Star", fields };
    });
  }

  dispose(): void {
    for (const renderable of this.polygonsByTopic.values()) {
      renderable.userData.lines?.dispose();
      renderable.userData.lines = undefined;
    }
    this.children.length = 0;
    this.polygonsByTopic.clear();
  }

  addPolygonStamped(topic: string, polygonStamped: PolygonStamped): void {
    let renderable = this.polygonsByTopic.get(topic);
    if (!renderable) {
      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsPolygon>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...userSettings };

      renderable = new THREE.Object3D() as PolygonRenderable;
      renderable.name = topic;
      renderable.userData = {
        topic,
        settings,
        polygonStamped,
        pose: makePose(),
        srcTime: toNanoSec(polygonStamped.header.stamp),
        lines: undefined,
      };

      this.add(renderable);
      this.polygonsByTopic.set(topic, renderable);
    }

    this._updatePolygonRenderable(renderable, polygonStamped);
  }

  setTopicSettings(topic: string, settings: Partial<LayerSettingsPolygon>): void {
    const renderable = this.polygonsByTopic.get(topic);
    if (renderable) {
      renderable.userData.settings = { ...renderable.userData.settings, ...settings };
      this._updatePolygonRenderable(renderable, renderable.userData.polygonStamped);
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

    for (const renderable of this.polygonsByTopic.values()) {
      renderable.visible = renderable.userData.settings.visible;
      if (!renderable.visible) {
        this.renderer.layerErrors.clearTopic(renderable.userData.topic);
        continue;
      }

      const srcTime = currentTime;
      const frameId = renderable.userData.polygonStamped.header.frame_id;
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
      } else {
        this.renderer.layerErrors.removeFromTopic(renderable.userData.topic, MISSING_TRANSFORM);
      }
    }
  }

  _updatePolygonRenderable(renderable: PolygonRenderable, polygonStamped: PolygonStamped): void {
    const settings = renderable.userData.settings;

    renderable.userData.polygonStamped = polygonStamped;
    renderable.userData.srcTime = toNanoSec(polygonStamped.header.stamp);

    const topic = renderable.userData.topic;
    const linesMarker = createLineStripMarker(polygonStamped, settings);
    if (!renderable.userData.lines) {
      renderable.userData.lines = new RenderableLineStrip(
        topic,
        linesMarker,
        undefined,
        this.renderer,
      );
      renderable.add(renderable.userData.lines);
    } else {
      renderable.userData.lines.update(linesMarker, undefined);
    }
  }
}

function createLineStripMarker(
  polygonStamped: PolygonStamped,
  settings: LayerSettingsPolygon,
): Marker {
  // Close the polygon
  const points = [...polygonStamped.polygon.points];
  if (points.length > 0) {
    points.push(points[0]!);
  }

  const linesMarker: Marker = {
    header: polygonStamped.header,
    ns: "",
    id: 0,
    type: MarkerType.LINE_STRIP,
    action: MarkerAction.ADD,
    pose: makePose(),
    scale: { x: settings.lineWidth, y: 1, z: 1 },
    color: stringToRgba(makeRgba(), settings.color),
    lifetime: TIME_ZERO,
    frame_locked: true,
    points,
    colors: [],
    text: "",
    mesh_resource: "",
    mesh_use_embedded_materials: false,
  };
  return linesMarker;
}
