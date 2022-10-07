// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";
import { Grid, NumericType, PackedElementField } from "@foxglove/schemas";
import { SettingsTreeAction } from "@foxglove/studio";
import { GRID_DATATYPES } from "@foxglove/studio-base/panels/ThreeDeeRender/foxglove";
import {
  baseColorModeSettingsNode,
  ColorModeSettings,
  getColorConverter,
  autoSelectColorField,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/pointClouds/colors";
import type { RosValue } from "@foxglove/studio-base/players/types";

import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { PartialMessage, PartialMessageEvent, SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry, SettingsTreeNodeWithActionHandler } from "../SettingsManager";
import { rgbaToCssString } from "../color";
import { normalizePose, normalizeTime, normalizeByteArray } from "../normalizeMessages";
import { BaseSettings } from "../settings";
import { FieldReader, getReader } from "./pointClouds/fieldReaders";

export type LayerSettingsFoxgloveGrid = BaseSettings &
  ColorModeSettings & {
    frameLocked: boolean;
  };
function zeroReader(): number {
  return 0;
}

const INVALID_FOXGLOVE_GRID = "INVALID_FOXGLOVE_GRID";

const DEFAULT_COLOR_MAP = "turbo";
const DEFAULT_FLAT_COLOR = { r: 1, g: 1, b: 1, a: 1 };
const DEFAULT_MIN_COLOR = { r: 100, g: 47, b: 105, a: 1 };
const DEFAULT_MAX_COLOR = { r: 227, g: 177, b: 135, a: 1 };
const SKIP_MIN_MAX = ["flat", "rgb", "rgba"];
const DEFAULT_RGB_BYTE_ORDER = "rgba";

const DEFAULT_SETTINGS: LayerSettingsFoxgloveGrid = {
  visible: false,
  frameLocked: false,
  colorMode: "flat",
  minValue: undefined,
  maxValue: undefined,
  flatColor: rgbaToCssString(DEFAULT_FLAT_COLOR),
  colorField: undefined,
  gradient: [rgbaToCssString(DEFAULT_MIN_COLOR), rgbaToCssString(DEFAULT_MAX_COLOR)],
  colorMap: DEFAULT_COLOR_MAP,
  explicitAlpha: 1,
  rgbByteOrder: DEFAULT_RGB_BYTE_ORDER,
};

export type FoxgloveGridUserData = BaseUserData & {
  settings: LayerSettingsFoxgloveGrid;
  topic: string;
  foxgloveGrid: Grid;
  mesh: THREE.Mesh;
  texture: THREE.DataTexture;
  material: THREE.MeshBasicMaterial;
  pickingMaterial: THREE.ShaderMaterial;
};

export class FoxgloveGridRenderable extends Renderable<FoxgloveGridUserData> {
  public override dispose(): void {
    this.userData.texture.dispose();
    this.userData.material.dispose();
    this.userData.pickingMaterial.dispose();
  }

  public override details(): Record<string, RosValue> {
    return this.userData.foxgloveGrid;
  }
}
const tempFieldReader = {
  fieldReader: zeroReader as FieldReader,
};
const tempColor = { r: 0, g: 0, b: 0, a: 1 };
const tempMinMaxColor: THREE.Vector2Tuple = [0, 0];
export class FoxgloveGrid extends SceneExtension<FoxgloveGridRenderable> {
  private static geometry: THREE.PlaneGeometry | undefined;
  private fieldsByTopic = new Map<string, string[]>();

  public constructor(renderer: Renderer) {
    super("foxglove.Grid", renderer);

    renderer.addDatatypeSubscriptions(GRID_DATATYPES, this.handleFoxgloveGrid);
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const topic of this.renderer.topics ?? []) {
      if (GRID_DATATYPES.has(topic.schemaName)) {
        const config = (configTopics[topic.name] ?? {}) as Partial<LayerSettingsFoxgloveGrid>;

        const node = baseColorModeSettingsNode(this.fieldsByTopic, config, topic, DEFAULT_SETTINGS);
        node.icon = "Cells";
        node.fields!.frameLocked = {
          label: "Frame lock",
          input: "boolean",
          value: config.frameLocked ?? DEFAULT_SETTINGS.frameLocked,
        };
        (node as SettingsTreeNodeWithActionHandler).handler = handler;
        entries.push({
          path: ["topics", topic.name],
          node,
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
        | Partial<LayerSettingsFoxgloveGrid>
        | undefined;
      renderable.userData.settings = { ...DEFAULT_SETTINGS, ...settings };

      this._updateFoxgloveGridRenderable(
        renderable,
        renderable.userData.foxgloveGrid,
        renderable.userData.receiveTime,
        renderable.userData.settings,
      );
    }
  };

  private handleFoxgloveGrid = (messageEvent: PartialMessageEvent<Grid>): void => {
    const topic = messageEvent.topic;
    const foxgloveGrid = normalizeFoxgloveGrid(messageEvent.message);
    const receiveTime = toNanoSec(messageEvent.receiveTime);

    let renderable = this.renderables.get(topic);
    if (!renderable) {
      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsFoxgloveGrid>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...userSettings };
      if (settings.colorField == undefined) {
        autoSelectColorField(settings, foxgloveGrid.fields);
        // Update user settings with the newly selected color field
        this.renderer.updateConfig((draft) => {
          const updatedUserSettings = { ...userSettings };
          updatedUserSettings.colorField = settings.colorField;
          updatedUserSettings.colorMode = settings.colorMode;
          updatedUserSettings.colorMap = settings.colorMap;
          draft.topics[topic] = updatedUserSettings;
        });
      }

      const texture = createTexture(foxgloveGrid);
      const mesh = createMesh(topic, texture);
      const material = mesh.material as THREE.MeshBasicMaterial;
      const pickingMaterial = mesh.userData.pickingMaterial as THREE.ShaderMaterial;

      // Create the renderable
      renderable = new FoxgloveGridRenderable(topic, this.renderer, {
        receiveTime,
        messageTime: toNanoSec(foxgloveGrid.timestamp),
        frameId: this.renderer.normalizeFrameId(foxgloveGrid.frame_id),
        pose: foxgloveGrid.pose,
        settingsPath: ["topics", topic],
        settings,
        topic,
        foxgloveGrid,
        mesh,
        texture,
        material,
        pickingMaterial,
      });
      renderable.add(mesh);

      this.add(renderable);
      this.renderables.set(topic, renderable);
    }

    let fields = this.fieldsByTopic.get(topic);
    if (!fields || fields.length !== foxgloveGrid.fields.length) {
      fields = foxgloveGrid.fields.map((field) => field.name);
      this.fieldsByTopic.set(topic, fields);
      this.updateSettingsTree();
    }

    this._updateFoxgloveGridRenderable(
      renderable,
      foxgloveGrid,
      receiveTime,
      renderable.userData.settings,
    );
  };

  private _getFieldReader(
    output: { fieldReader: FieldReader },
    foxgloveGrid: Grid,
    renderable: FoxgloveGridRenderable,
    settings: LayerSettingsFoxgloveGrid,
  ): boolean {
    let colorReader: FieldReader | undefined;

    const stride = foxgloveGrid.cell_stride;

    // Determine the minimum bytes needed per cell based on offset/size of each
    // field, so we can ensure cell_stride is >= this value
    let minBytesPerCell = 0;

    for (let i = 0; i < foxgloveGrid.fields.length; i++) {
      const field = foxgloveGrid.fields[i]!;
      const { type, offset, name } = field;

      const byteWidth = numericTypeWidth(type);
      minBytesPerCell = Math.max(minBytesPerCell, offset + byteWidth);

      if (name === settings.colorField) {
        // If the selected color mode is rgb/rgba and the field only has one channel with at least a
        // four byte width, force the color data to be interpreted as four individual bytes. This
        // overcomes a common problem where the color field data type is set to float32 or something
        // other than uint32
        const forceType =
          (settings.colorMode === "rgb" || settings.colorMode === "rgba") && byteWidth >= 4
            ? NumericType.UINT32
            : undefined;
        colorReader = getReader(field, stride, forceType);
        if (!colorReader) {
          const typeName = NumericType[type];
          const message = `Grid field "${field.name}" is invalid. type=${typeName}, offset=${field.offset}, stride=${stride}`;
          invalidFoxgloveGridError(this.renderer, renderable, message);
          return false;
        }
      }
    }

    if (minBytesPerCell > stride) {
      const message = `Grid stride ${stride} is less than minimum bytes per cell ${minBytesPerCell}`;
      invalidFoxgloveGridError(this.renderer, renderable, message);
      return false;
    }

    output.fieldReader = colorReader ?? zeroReader;
    return true;
  }

  private _updateFoxgloveGridRenderable(
    renderable: FoxgloveGridRenderable,
    foxgloveGrid: Grid,
    receiveTime: bigint,
    settings: LayerSettingsFoxgloveGrid,
  ): void {
    renderable.userData.foxgloveGrid = foxgloveGrid;
    renderable.userData.pose = foxgloveGrid.pose;
    renderable.userData.receiveTime = receiveTime;
    renderable.userData.messageTime = toNanoSec(foxgloveGrid.timestamp);
    renderable.userData.frameId = this.renderer.normalizeFrameId(foxgloveGrid.frame_id);
    if (foxgloveGrid.fields.length === 0) {
      invalidFoxgloveGridError(
        this.renderer,
        renderable,
        `Foxglove grid from topic ${renderable.userData.topic} has no fields to color by`,
      );
      return;
    }
    const { cell_stride } = foxgloveGrid;
    const { cols, rows } = getFoxgloveGridDimensions(foxgloveGrid);
    const size = cols * rows * foxgloveGrid.cell_stride;
    if (foxgloveGrid.data.length !== size) {
      const message = `FoxgloveGrid data length (${foxgloveGrid.data.length}) is not equal to cols ${cols} * rows ${rows} * cell_stride ${cell_stride}`;
      invalidFoxgloveGridError(this.renderer, renderable, message);
      return;
    }
    if (!this._getFieldReader(tempFieldReader, foxgloveGrid, renderable, settings)) {
      return;
    }

    const data = foxgloveGrid.data;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const cellCount = rows * cols;

    // Iterate the grid data to determine min/max color values (if needed)
    minMaxColorValues(
      tempMinMaxColor,
      settings,
      foxgloveGrid.fields.find((field) => settings.colorField === field.name)?.type ??
        NumericType.UNKNOWN,
    );

    let texture = renderable.userData.texture;

    if (cols !== texture.image.width || rows !== texture.image.height) {
      // The image dimensions changed, regenerate the texture
      texture.dispose();
      texture = createTexture(foxgloveGrid);
      renderable.userData.texture = texture;
      renderable.userData.material.map = texture;
    }

    const rgba = texture.image.data;
    let hasTransparency = false;

    const [minColorValue, maxColorValue] = tempMinMaxColor;
    const { fieldReader } = tempFieldReader;
    const colorConverter = getColorConverter(settings, minColorValue, maxColorValue);
    for (let i = 0; i < cellCount; i++) {
      const offset = i * foxgloveGrid.cell_stride;
      const colorValue = fieldReader(view, offset);
      colorConverter(tempColor, colorValue);
      const rgbaOffset = i * 4;
      rgba[rgbaOffset + 0] = Math.floor(tempColor.r * 255);
      rgba[rgbaOffset + 1] = Math.floor(tempColor.g * 255);
      rgba[rgbaOffset + 2] = Math.floor(tempColor.b * 255);
      rgba[rgbaOffset + 3] = Math.floor(tempColor.a * 255);

      // We cheat a little with transparency: alpha 0 will be handled by the alphaTest setting, so
      // we don't need to set material.transparent = true.
      if (tempColor.a !== 0 && tempColor.a !== 1) {
        hasTransparency = true;
      }
    }

    texture.needsUpdate = true;

    if (renderable.userData.material.transparent !== hasTransparency) {
      renderable.userData.material.transparent = hasTransparency;
      renderable.userData.material.depthWrite = !hasTransparency;
      renderable.userData.material.needsUpdate = true;
    }

    renderable.scale.set(foxgloveGrid.cell_size.x * cols, foxgloveGrid.cell_size.y * rows, 1);
  }

  public static Geometry(): THREE.PlaneGeometry {
    if (!FoxgloveGrid.geometry) {
      FoxgloveGrid.geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
      FoxgloveGrid.geometry.translate(0.5, 0.5, 0);
      FoxgloveGrid.geometry.computeBoundingSphere();
    }
    return FoxgloveGrid.geometry;
  }
}

function invalidFoxgloveGridError(
  renderer: Renderer,
  renderable: FoxgloveGridRenderable,
  message: string,
): void {
  renderer.settings.errors.addToTopic(renderable.userData.topic, INVALID_FOXGLOVE_GRID, message);
}
function getFoxgloveGridDimensions(grid: Grid) {
  return {
    cols: grid.column_count,
    rows: grid.data.byteLength / grid.row_stride,
  };
}

function createTexture(foxgloveGrid: Grid): THREE.DataTexture {
  const { cols, rows } = getFoxgloveGridDimensions(foxgloveGrid);
  const size = cols * rows;
  const rgba = new Uint8ClampedArray(size * 4);
  const texture = new THREE.DataTexture(
    rgba,
    cols,
    rows,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
    THREE.UVMapping,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.NearestFilter,
    THREE.LinearFilter,
    1,
    THREE.LinearEncoding, // FoxgloveGrid carries linear grayscale values, not sRGB
  );
  texture.generateMipmaps = false;
  return texture;
}

function createMesh(topic: string, texture: THREE.DataTexture): THREE.Mesh {
  // Create the texture, material, and mesh
  const pickingMaterial = createPickingMaterial(texture);
  const material = createMaterial(texture, topic);
  const mesh = new THREE.Mesh(FoxgloveGrid.Geometry(), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // This overrides the picking material used for `mesh`. See Picker.ts
  mesh.userData.pickingMaterial = pickingMaterial;
  return mesh;
}

function numericTypeWidth(type: NumericType): number {
  switch (type) {
    case NumericType.INT8:
    case NumericType.UINT8:
      return 1;
    case NumericType.INT16:
    case NumericType.UINT16:
      return 2;
    case NumericType.INT32:
    case NumericType.UINT32:
    case NumericType.FLOAT32:
      return 4;
    case NumericType.FLOAT64:
      return 8;
    default:
      return 0;
  }
}

function createMaterial(texture: THREE.DataTexture, topic: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    name: `${topic}:Material`,
    // Enable alpha clipping. Fully transparent (alpha=0) pixels are skipped
    // even when transparency is disabled
    alphaTest: 1e-4,
    map: texture,
    side: THREE.DoubleSide,
  });
}

function createPickingMaterial(texture: THREE.DataTexture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec4 objectId;
      varying vec2 vUv;
      void main() {
        vec4 color = texture2D(map, vUv);
        if (color.a == 0.0) {
          discard;
        }
        gl_FragColor = objectId;
      }
    `,
    side: THREE.DoubleSide,
    uniforms: { map: { value: texture }, objectId: { value: [NaN, NaN, NaN, NaN] } },
  });
}

function normalizePackedElementField(
  field: PartialMessage<PackedElementField> | undefined,
): PackedElementField {
  return {
    name: field?.name ?? "",
    offset: field?.offset ?? 0,
    type: field?.type ?? 0,
  };
}

function normalizeFoxgloveGrid(message: PartialMessage<Grid>): Grid {
  return {
    timestamp: normalizeTime(message.timestamp),
    pose: normalizePose(message.pose),
    frame_id: message.frame_id ?? "",
    row_stride: message.row_stride ?? 0,
    cell_stride: message.cell_stride ?? 0,
    column_count: message.column_count ?? 0,
    cell_size: {
      x: message.cell_size?.x ?? 1,
      y: message.cell_size?.y ?? 1,
    },
    fields: message.fields?.map(normalizePackedElementField) ?? [],
    data: normalizeByteArray(message.data),
  };
}

function minMaxColorValues(
  output: THREE.Vector2Tuple,
  settings: LayerSettingsFoxgloveGrid,
  numericType: NumericType,
): void {
  if (SKIP_MIN_MAX.includes(settings.colorMode)) {
    return;
  }

  const [numericMin, numericMax] = NumericTypeMinMaxValueMap[numericType];
  const minColorValue = settings.minValue ?? numericMin;
  const maxColorValue = settings.maxValue ?? numericMax;
  output[0] = minColorValue;
  output[1] = maxColorValue;
}

const NumericTypeMinMaxValueMap: Record<NumericType, [number, number]> = {
  [NumericType.UNKNOWN]: [0, 1.0],
  [NumericType.UINT8]: [0, 255],
  [NumericType.UINT16]: [0, 65535],
  [NumericType.UINT32]: [0, Math.pow(2, 32) - 1],
  [NumericType.INT8]: [-128, 127],
  [NumericType.INT16]: [-Math.pow(2, 16 - 1), -Math.pow(2, 16 - 1) - 1],
  [NumericType.INT32]: [-Math.pow(2, 32 - 1), -Math.pow(2, 32 - 1) - 1],
  [NumericType.FLOAT32]: [0, 1.0],
  [NumericType.FLOAT64]: [0, 1.0],
};
