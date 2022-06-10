// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEqual } from "lodash";
import * as THREE from "three";

import { SettingsTreeFields } from "@foxglove/studio-base/components/SettingsTreeEditor/types";
import { RenderableLineList } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/markers/RenderableLineList";

import { Renderer } from "../Renderer";
import { stringToRgba } from "../color";
import { Marker, Pose, TIME_ZERO, Vector3 } from "../ros";
import { LayerSettingsGrid, LayerType, PRECISION_DEGREES, PRECISION_DISTANCE } from "../settings";
import { makePose, xyzrpyToPose } from "../transforms/geometry";
import { updatePose } from "../updatePose";
import { missingTransformMessage, MISSING_TRANSFORM } from "./transforms";

const DEFAULT_SIZE = 10;
const DEFAULT_DIVISIONS = 10;
const DEFAULT_LINE_WIDTH = 0.1;
const DEFAULT_COLOR = "#ffffff";
const MAX_DIVISIONS = 4096; // The JS heap size is a limiting factor

const DEFAULT_SETTINGS: LayerSettingsGrid = {
  label: "Grid",
  type: LayerType.Grid,
  visible: true,
  frameId: undefined,
  size: DEFAULT_SIZE,
  divisions: DEFAULT_DIVISIONS,
  lineWidth: DEFAULT_LINE_WIDTH,
  color: DEFAULT_COLOR,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
};

type GridRenderable = Omit<THREE.Object3D, "userData"> & {
  userData: {
    path: ReadonlyArray<string>;
    settings: LayerSettingsGrid;
    pose: Pose;
    lineList: RenderableLineList;
  };
};

export class Grids extends THREE.Object3D {
  renderer: Renderer;
  gridsById = new Map<string, GridRenderable>();

  constructor(renderer: Renderer) {
    super();
    this.renderer = renderer;

    renderer.setSettingsNodeProvider(LayerType.Grid, (layerConfig, _) => {
      const cur = layerConfig as Partial<LayerSettingsGrid>;

      // prettier-ignore
      const fields: SettingsTreeFields = {
        frameId: { label: "Frame", input: "select", options: [{ label: "<Render Frame>", value: undefined }], value: cur.frameId }, // options is extended in `settings.ts:buildTopicNode()`
        size: { label: "Size", input: "number", min: 0, step: 0.5, precision: PRECISION_DISTANCE, value: cur.size, placeholder: String(DEFAULT_SIZE) },
        divisions: { label: "Divisions", input: "number", min: 1, max: MAX_DIVISIONS, step: 1, precision: 0, value: cur.divisions, placeholder: String(DEFAULT_DIVISIONS) },
        lineWidth: { label: "Line Width", input: "number", min: 0, step: 0.01, precision: PRECISION_DISTANCE, value: cur.lineWidth, placeholder: String(DEFAULT_LINE_WIDTH) },
        color: { label: "Color", input: "rgba", value: cur.color ?? DEFAULT_COLOR },
        position: { label: "Position", input: "vec3", labels: ["X", "Y", "Z"], precision: PRECISION_DISTANCE, value: cur.position ?? [0, 0, 0] },
        rotation: { label: "Rotation", input: "vec3", labels: ["R", "P", "Y"], precision: PRECISION_DEGREES, value: cur.rotation ?? [0, 0, 0] },
      };

      return { icon: "Grid", fields };
    });
  }

  dispose(): void {
    for (const renderable of this.gridsById.values()) {
      renderable.userData.lineList.dispose();
    }
    this.children.length = 0;
    this.gridsById.clear();
  }

  setLayerSettings(id: string, settings: Partial<LayerSettingsGrid> | undefined): void {
    let renderable = this.gridsById.get(id);

    // Handle deletes
    if (settings == undefined) {
      if (renderable != undefined) {
        renderable.userData.lineList.dispose();
        this.remove(renderable);
        this.gridsById.delete(id);
      }
      return;
    }

    if (!renderable) {
      renderable = new THREE.Object3D() as GridRenderable;
      renderable.name = `grid:${id}`;
      const marker = createMarker(DEFAULT_SETTINGS);
      renderable.userData = {
        path: ["layers", id],
        settings: { ...DEFAULT_SETTINGS },
        pose: makePose(),
        lineList: new RenderableLineList(renderable.name, marker, undefined, this.renderer),
      };
      renderable.add(renderable.userData.lineList);

      this.add(renderable);
      this.gridsById.set(id, renderable);
    }

    const prevSettings = renderable.userData.settings;
    const newSettings = { ...prevSettings, ...settings };
    const markersEqual =
      newSettings.size === prevSettings.size &&
      newSettings.divisions === prevSettings.divisions &&
      newSettings.frameId === prevSettings.frameId &&
      newSettings.lineWidth === prevSettings.lineWidth &&
      newSettings.color === prevSettings.color;

    renderable.userData.settings = newSettings;

    // If the marker settings changed, generate a new marker and update the renderable
    if (!markersEqual) {
      const marker = createMarker(newSettings);
      renderable.userData.lineList.update(marker, undefined);
    }

    // Update the pose if it changed
    if (
      !isEqual(newSettings.position, prevSettings.position) ||
      !isEqual(newSettings.rotation, prevSettings.rotation)
    ) {
      renderable.userData.pose = xyzrpyToPose(newSettings.position, newSettings.rotation);
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

    for (const renderable of this.gridsById.values()) {
      const path = renderable.userData.path;
      const frameId = renderable.userData.settings.frameId ?? renderFrameId;

      renderable.visible = renderable.userData.settings.visible;
      if (!renderable.visible) {
        this.renderer.layerErrors.clearPath(path);
        continue;
      }

      const updated = updatePose(
        renderable,
        this.renderer.transformTree,
        renderFrameId,
        fixedFrameId,
        frameId,
        currentTime,
        currentTime,
      );
      renderable.visible = updated;
      if (!updated) {
        const message = missingTransformMessage(renderFrameId, fixedFrameId, frameId);
        this.renderer.layerErrors.add(path, MISSING_TRANSFORM, message);
      } else {
        this.renderer.layerErrors.remove(path, MISSING_TRANSFORM);
      }
    }
  }
}

function createMarker(settings: LayerSettingsGrid): Marker {
  const { size, divisions, color: colorStr } = settings;
  const step = size / divisions;
  const halfSize = size / 2;
  const points: Vector3[] = [];
  // Create a grid of line segments
  for (let i = 0; i <= divisions; i++) {
    const x = -halfSize + i * step;
    points.push({ x, y: -halfSize, z: 0 });
    points.push({ x, y: halfSize, z: 0 });
    points.push({ x: -halfSize, y: x, z: 0 });
    points.push({ x: halfSize, y: x, z: 0 });
  }

  const color = { r: 1, g: 1, b: 1, a: 1 };
  stringToRgba(color, colorStr);

  return {
    header: {
      frame_id: "", // unused, settings.frameId is used instead
      stamp: TIME_ZERO,
    },
    ns: "",
    id: 0,
    type: 0,
    action: 0,
    pose: makePose(),
    scale: { x: settings.lineWidth, y: 1, z: 1 },
    color,
    lifetime: TIME_ZERO,
    frame_locked: true,
    points,
    colors: [],
    text: "",
    mesh_resource: "",
    mesh_use_embedded_materials: false,
  };
}
