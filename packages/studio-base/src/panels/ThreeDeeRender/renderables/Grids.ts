// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { maxBy } from "lodash";

import Logger from "@foxglove/log";
import { SettingsTreeAction, SettingsTreeFields } from "@foxglove/studio";

import { RenderableLineList } from "./markers/RenderableLineList";
import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { stringToRgba } from "../color";
import { vec3TupleApproxEquals } from "../math";
import { Marker, MarkerAction, MarkerType, TIME_ZERO, Vector3 } from "../ros";
import { CustomLayerSettings, PRECISION_DEGREES, PRECISION_DISTANCE } from "../settings";
import { makePose, xyzrpyToPose } from "../transforms";

const log = Logger.getLogger(__filename);

export type LayerSettingsGrid = CustomLayerSettings & {
  layerId: "foxglove.Grid";
  frameId: string | undefined;
  size: number;
  divisions: number;
  lineWidth: number;
  color: string;
  position: [number, number, number];
  rotation: [number, number, number];
};

const LAYER_ID = "foxglove.Grid";
const DEFAULT_SIZE = 10;
const DEFAULT_DIVISIONS = 10;
const DEFAULT_LINE_WIDTH = 1;
const DEFAULT_COLOR = "#248eff";
const MAX_DIVISIONS = 4096; // The JS heap size is a limiting factor
const LINE_OPTIONS = { worldUnits: false };

const DEFAULT_SETTINGS: LayerSettingsGrid = {
  visible: true,
  frameLocked: true,
  label: "Grid",
  instanceId: "invalid",
  layerId: LAYER_ID,
  frameId: undefined,
  size: DEFAULT_SIZE,
  divisions: DEFAULT_DIVISIONS,
  lineWidth: DEFAULT_LINE_WIDTH,
  color: DEFAULT_COLOR,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
};

export type GridUserData = BaseUserData & {
  settings: LayerSettingsGrid;
  lineList: RenderableLineList;
};

export class GridRenderable extends Renderable<GridUserData> {
  public override dispose(): void {
    this.userData.lineList.dispose();
    super.dispose();
  }
}

export class Grids extends SceneExtension<GridRenderable> {
  public constructor(renderer: Renderer) {
    super("foxglove.Grids", renderer);

    renderer.addCustomLayerAction({
      layerId: LAYER_ID,
      label: "Add Grid",
      icon: "Grid",
      handler: this.handleAddGrid,
    });

    renderer.on("transformTreeUpdated", this.handleTransformTreeUpdated);

    // Load existing grid layers from the config
    for (const [instanceId, entry] of Object.entries(renderer.config.layers)) {
      if (entry?.layerId === LAYER_ID) {
        this._updateGrid(instanceId, entry as Partial<LayerSettingsGrid>);
      }
    }
  }

  public override dispose(): void {
    this.renderer.off("transformTreeUpdated", this.handleTransformTreeUpdated);
    super.dispose();
  }

  public override removeAllRenderables(): void {
    // no-op
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const [instanceId, layerConfig] of Object.entries(this.renderer.config.layers)) {
      if (layerConfig?.layerId !== LAYER_ID) {
        continue;
      }

      const config = layerConfig as Partial<LayerSettingsGrid>;
      const frameIdOptions = [
        { label: "<Display frame>", value: undefined },
        ...this.renderer.coordinateFrameList,
      ];

      // prettier-ignore
      const fields: SettingsTreeFields = {
        frameId: { label: "Frame", input: "select", options: frameIdOptions, value: config.frameId }, // options is extended in `settings.ts:buildTopicNode()`
        size: { label: "Size", input: "number", min: 0, step: 0.5, precision: PRECISION_DISTANCE, value: config.size, placeholder: String(DEFAULT_SIZE) },
        divisions: { label: "Divisions", input: "number", min: 1, max: MAX_DIVISIONS, step: 1, precision: 0, value: config.divisions, placeholder: String(DEFAULT_DIVISIONS) },
        lineWidth: { label: "Line Width", input: "number", min: 0, step: 0.5, precision: 1, value: config.lineWidth, placeholder: String(DEFAULT_LINE_WIDTH) },
        color: { label: "Color", input: "rgba", value: config.color ?? DEFAULT_COLOR },
        position: { label: "Position", input: "vec3", labels: ["X", "Y", "Z"], precision: PRECISION_DISTANCE, value: config.position ?? [0, 0, 0] },
        rotation: { label: "Rotation", input: "vec3", labels: ["R", "P", "Y"], precision: PRECISION_DEGREES, value: config.rotation ?? [0, 0, 0] },
      };

      entries.push({
        path: ["layers", instanceId],
        node: {
          label: config.label ?? "Grid",
          icon: "Grid",
          fields,
          visible: config.visible ?? DEFAULT_SETTINGS.visible,
          actions: [{ type: "action", id: "delete", label: "Delete" }],
          order: layerConfig.order,
          handler,
        },
      });

      // Create renderables for new grid layers
      if (!this.renderables.has(instanceId)) {
        this._updateGrid(instanceId, config);
      }
    }
    return entries;
  }

  public override startFrame(
    currentTime: bigint,
    renderFrameId: string,
    fixedFrameId: string,
  ): void {
    // Set the `frameId` to use for `updatePose()`
    for (const renderable of this.renderables.values()) {
      renderable.userData.frameId = renderable.userData.settings.frameId ?? renderFrameId;
    }
    super.startFrame(currentTime, renderFrameId, fixedFrameId);
  }

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;

    // Handle menu actions (delete)
    if (action.action === "perform-node-action") {
      if (path.length === 2 && action.payload.id === "delete") {
        const instanceId = path[1]!;

        // Remove this instance from the config
        this.renderer.updateConfig((draft) => {
          delete draft.layers[instanceId];
        });

        // Remove the renderable
        this._updateGrid(instanceId, undefined);

        // Update the settings tree
        this.updateSettingsTree();
        this.renderer.updateCustomLayersCount();
      }
      return;
    }

    if (path.length !== 3) {
      return; // Doesn't match the pattern of ["layers", instanceId, field]
    }

    this.saveSetting(path, action.payload.value);

    const instanceId = path[1]!;
    const settings = this.renderer.config.layers[instanceId] as
      | Partial<LayerSettingsGrid>
      | undefined;
    this._updateGrid(instanceId, settings);
  };

  private handleAddGrid = (instanceId: string): void => {
    log.info(`Creating ${LAYER_ID} layer ${instanceId}`);

    const config: LayerSettingsGrid = { ...DEFAULT_SETTINGS, instanceId };

    // Add this instance to the config
    this.renderer.updateConfig((draft) => {
      const maxOrderLayer = maxBy(Object.values(draft.layers), (layer) => layer?.order);
      const order = 1 + (maxOrderLayer?.order ?? 0);
      draft.layers[instanceId] = { ...config, order };
    });

    // Add a renderable
    this._updateGrid(instanceId, config);

    // Update the settings tree
    this.updateSettingsTree();
  };

  private handleTransformTreeUpdated = (): void => {
    this.updateSettingsTree();
  };

  private _updateGrid(instanceId: string, settings: Partial<LayerSettingsGrid> | undefined): void {
    let renderable = this.renderables.get(instanceId);

    // Handle deletes
    if (settings == undefined) {
      if (renderable != undefined) {
        renderable.userData.lineList.dispose();
        this.remove(renderable);
        this.renderables.delete(instanceId);
      }
      return;
    }

    const newSettings = { ...DEFAULT_SETTINGS, ...settings };
    if (!renderable) {
      renderable = this._createRenderable(instanceId, newSettings);
      renderable.userData.pose = xyzrpyToPose(newSettings.position, newSettings.rotation);
    }

    const prevSettings = renderable.userData.settings;
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
      !vec3TupleApproxEquals(newSettings.position, prevSettings.position) ||
      !vec3TupleApproxEquals(newSettings.rotation, prevSettings.rotation)
    ) {
      renderable.userData.pose = xyzrpyToPose(newSettings.position, newSettings.rotation);
    }
  }

  private _createRenderable(instanceId: string, settings: LayerSettingsGrid): GridRenderable {
    const marker = createMarker(settings);
    const lineListId = `${instanceId}:LINE_LIST`;
    const lineList = new RenderableLineList(
      lineListId,
      marker,
      undefined,
      this.renderer,
      LINE_OPTIONS,
    );
    const renderable = new GridRenderable(instanceId, this.renderer, {
      receiveTime: 0n,
      messageTime: 0n,
      frameId: "", // This will be updated in `startFrame()`
      pose: makePose(),
      settingsPath: ["layers", instanceId],
      settings,
      lineList,
    });
    renderable.add(lineList);

    this.add(renderable);
    this.renderables.set(instanceId, renderable);
    return renderable;
  }
}

function createMarker(settings: LayerSettingsGrid): Marker {
  const { size, divisions, color: colorStr } = settings;
  const step = size / divisions;
  const halfSize = size / 2;
  const points: Vector3[] = [];
  // Create a grid of line segments centered around <0, 0>
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
    type: MarkerType.LINE_LIST,
    action: MarkerAction.ADD,
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
