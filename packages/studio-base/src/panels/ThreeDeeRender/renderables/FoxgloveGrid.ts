// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";
import { Grid, NumericType, PackedElementField } from "@foxglove/schemas";
import { SettingsTreeAction } from "@foxglove/studio";
import { GRID_DATATYPES } from "@foxglove/studio-base/panels/ThreeDeeRender/foxglove";
import type { RosValue } from "@foxglove/studio-base/players/types";

import {
  colorModeSettingsFields,
  ColorModeSettings,
  getColorConverter,
  NEEDS_MIN_MAX,
  FS_SRGB_TO_LINEAR,
  RGBA_PACKED_FIELDS,
  hasSeparateRgbaFields,
} from "./colorMode";
import { FieldReader, getReader } from "./pointClouds/fieldReaders";
import type { AnyRendererSubscription, IRenderer } from "../IRenderer";
import { BaseUserData, Renderable } from "../Renderable";
import {
  PartialMessage,
  PartialMessageEvent,
  SceneExtension,
  onlyLastByTopicMessage,
} from "../SceneExtension";
import { SettingsTreeEntry, SettingsTreeNodeWithActionHandler } from "../SettingsManager";
import { rgbaToCssString, rgbaToLinear, stringToRgba } from "../color";
import { normalizePose, normalizeTime, normalizeByteArray } from "../normalizeMessages";
import { BaseSettings } from "../settings";
import { topicIsConvertibleToSchema } from "../topicIsConvertibleToSchema";

type GridColorModeSettings = ColorModeSettings & {
  // rgba packed modes are only supported for sensor_msgs/PointCloud2
  colorMode: Exclude<ColorModeSettings["colorMode"], "rgb" | "rgba">;
};

export type LayerSettingsFoxgloveGrid = BaseSettings &
  GridColorModeSettings & {
    frameLocked: boolean;
  };
function zeroReader(): number {
  return 0;
}

const floatTextureColorModes: GridColorModeSettings["colorMode"][] = ["gradient", "colormap"];

const INVALID_FOXGLOVE_GRID = "INVALID_FOXGLOVE_GRID";

const DEFAULT_COLOR_MAP = "turbo";
const DEFAULT_FLAT_COLOR = { r: 1, g: 1, b: 1, a: 1 };
const DEFAULT_MIN_COLOR = { r: 100 / 255, g: 47 / 255, b: 105 / 255, a: 1 };
const DEFAULT_MAX_COLOR = { r: 227 / 255, g: 177 / 255, b: 135 / 255, a: 1 };

const COLOR_MODE_TO_GLSL: {
  [K in GridColorModeSettings["colorMode"] as `COLOR_MODE_${K extends "rgba-fields"
    ? "RGBA"
    : Uppercase<K>}`]: number;
} = {
  COLOR_MODE_FLAT: 0,
  COLOR_MODE_RGBA: 1,
  COLOR_MODE_GRADIENT: 2,
  COLOR_MODE_COLORMAP: 3,
};

const COLOR_MAP_TO_GLSL: {
  [K in ColorModeSettings["colorMap"] as `COLOR_MAP_${Uppercase<K>}`]: number;
} = {
  COLOR_MAP_TURBO: 0,
  COLOR_MAP_RAINBOW: 1,
};

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
};

interface GridShaderMaterial extends THREE.ShaderMaterial {
  uniforms: {
    map: THREE.IUniform<THREE.DataTexture>;

    colorMode: THREE.IUniform<number>;
    minValue: THREE.IUniform<number>;
    maxValue: THREE.IUniform<number>;

    colorMap: THREE.IUniform<number>;
    colorMapOpacity: THREE.IUniform<number>;

    minGradientColorLinear: THREE.IUniform<THREE.Vector4>;
    maxGradientColorLinear: THREE.IUniform<THREE.Vector4>;
  };
  defines: typeof COLOR_MODE_TO_GLSL &
    typeof COLOR_MAP_TO_GLSL & {
      PICKING: number;
    };
}

export type FoxgloveGridUserData = BaseUserData & {
  settings: LayerSettingsFoxgloveGrid;
  topic: string;
  foxgloveGrid: Grid;
  mesh: THREE.Mesh;
  texture: THREE.DataTexture;
  material: GridShaderMaterial;
  pickingMaterial: THREE.ShaderMaterial;
};

type RgbaFieldReaders = {
  redReader: FieldReader;
  greenReader: FieldReader;
  blueReader: FieldReader;
  alphaReader: FieldReader;
};
const tempRgbaFieldReaders: RgbaFieldReaders = {
  redReader: zeroReader,
  greenReader: zeroReader,
  blueReader: zeroReader,
  alphaReader: zeroReader,
};

function numericTypeName(type: NumericType): string {
  return NumericType[type as number] ?? `${type}`;
}

function getTextureColorSpace(settings: GridColorModeSettings): THREE.ColorSpace {
  switch (settings.colorMode) {
    case "flat":
      // color is converted to linear by getColorConverter before being written to the texture
      return THREE.LinearSRGBColorSpace;
    case "gradient":
    case "colormap":
      // color value is raw numeric value
      return THREE.LinearSRGBColorSpace;
    case "rgba-fields":
      return THREE.SRGBColorSpace;
  }
}

const tempColor = { r: 0, g: 0, b: 0, a: 1 };
const tempMinMaxColor: THREE.Vector2Tuple = [0, 0];
export class FoxgloveGridRenderable extends Renderable<FoxgloveGridUserData> {
  public override dispose(): void {
    this.userData.texture.dispose();
    this.userData.material.dispose();
    this.userData.pickingMaterial.dispose();
  }

  public override details(): Record<string, RosValue> {
    return this.userData.foxgloveGrid;
  }

  public syncPickingMaterial(): void {
    const { pickingMaterial, material } = this.userData;
    pickingMaterial.uniforms = material.uniforms;
    pickingMaterial.needsUpdate = true;
  }

  #getRgbaFieldReaders(out: RgbaFieldReaders, foxgloveGrid: Grid) {
    const { cell_stride } = foxgloveGrid;
    for (const field of foxgloveGrid.fields) {
      const { name } = field;
      if (name === "red") {
        out.redReader = getReader(field, cell_stride, /*normalize*/ true) ?? zeroReader;
      } else if (name === "green") {
        out.greenReader = getReader(field, cell_stride, /*normalize*/ true) ?? zeroReader;
      } else if (name === "blue") {
        out.blueReader = getReader(field, cell_stride, /*normalize*/ true) ?? zeroReader;
      } else if (name === "alpha") {
        out.alphaReader = getReader(field, cell_stride, /*normalize*/ true) ?? zeroReader;
      }
    }
  }

  #getColorByFieldReader(
    foxgloveGrid: Grid,
    settings: LayerSettingsFoxgloveGrid,
  ): FieldReader | undefined {
    const { cell_stride } = foxgloveGrid;

    for (const field of foxgloveGrid.fields) {
      const { type, offset, name } = field;

      if (name === settings.colorField) {
        const fieldReader = getReader(field, cell_stride);
        if (!fieldReader) {
          const typeName = NumericType[type];
          const message = `Grid field "${name}" is invalid. type=${typeName}, offset=${offset}, stride=${cell_stride}`;
          invalidFoxgloveGridError(this.renderer, this.userData.topic, message);
          return undefined;
        }
        return fieldReader;
      }
    }

    return zeroReader;
  }

  public updateMaterial(settings: LayerSettingsFoxgloveGrid): void {
    const { colorMode } = settings;
    const { material } = this.userData;
    let updated = false;
    let transparent = false;
    if (colorMode === "flat") {
      stringToRgba(tempColor, settings.flatColor);
      transparent = tempColor.a < 1.0;
    } else if (colorMode === "gradient") {
      stringToRgba(tempColor, settings.gradient[0]);
      transparent = tempColor.a < 1.0;

      stringToRgba(tempColor, settings.gradient[1]);
      transparent = transparent || tempColor.a < 1.0;
    } else if (colorMode === "colormap") {
      transparent = settings.explicitAlpha < 1.0;
    }
    if (transparent !== material.transparent) {
      material.depthWrite = !transparent;
      material.transparent = transparent;
      updated = true;
    }
    if (updated) {
      material.needsUpdate = true;
    }
  }

  public updateUniforms(foxgloveGrid: Grid, settings: LayerSettingsFoxgloveGrid): void {
    const { material } = this.userData;
    const {
      uniforms: {
        colorMode,
        colorMap,
        colorMapOpacity,
        minValue,
        maxValue,
        minGradientColorLinear,
        maxGradientColorLinear,
      },
    } = material;

    if (settings.colorMode === "rgba-fields") {
      colorMode.value = COLOR_MODE_TO_GLSL.COLOR_MODE_RGBA;
    } else {
      colorMode.value = COLOR_MODE_TO_GLSL[`COLOR_MODE_${settings.colorMode.toUpperCase()}`];
    }

    colorMap.value = COLOR_MAP_TO_GLSL[`COLOR_MAP_${settings.colorMap.toUpperCase()}`];

    colorMapOpacity.value = settings.explicitAlpha;

    minMaxColorValues(
      tempMinMaxColor,
      settings,
      foxgloveGrid.fields.find((field) => settings.colorField === field.name)?.type ??
        NumericType.UNKNOWN,
    );

    const [minColorValue, maxColorValue] = tempMinMaxColor;
    minValue.value = minColorValue;
    maxValue.value = maxColorValue;

    const minColor = stringToRgba(tempColor, settings.gradient[0]);
    rgbaToLinear(minColor, minColor);
    minGradientColorLinear.value.set(minColor.r, minColor.g, minColor.b, minColor.a);

    const maxColor = stringToRgba(tempColor, settings.gradient[1]);
    rgbaToLinear(maxColor, maxColor);
    maxGradientColorLinear.value.set(maxColor.r, maxColor.g, maxColor.b, maxColor.a);
    // unnecessary to update material because all uniforms are sent to GPU every frame
  }

  public updateTexture(foxgloveGrid: Grid, settings: LayerSettingsFoxgloveGrid): void {
    let texture = this.userData.texture;
    const fieldReader = this.#getColorByFieldReader(foxgloveGrid, settings);
    if (!fieldReader) {
      return;
    }

    const view = new DataView(
      foxgloveGrid.data.buffer,
      foxgloveGrid.data.byteOffset,
      foxgloveGrid.data.byteLength,
    );

    const { column_count: cols, row_stride, cell_stride } = foxgloveGrid;
    const rows = foxgloveGrid.data.length / row_stride;
    const sizeChanged = cols !== texture.image.width || rows !== texture.image.height;
    const floatMode = floatTextureColorModes.includes(settings.colorMode);
    const formatChanged = floatMode
      ? texture.format !== THREE.RedFormat
      : texture.format !== THREE.RGBAFormat;
    if (formatChanged || sizeChanged) {
      // The image dimensions or format changed, regenerate the texture
      texture.dispose();
      texture = createTexture(foxgloveGrid, settings);
      texture.generateMipmaps = false;
      this.userData.texture = texture;
      this.userData.material.uniforms.map.value = texture;
    }

    const colorSpace = getTextureColorSpace(settings);
    if (colorSpace !== texture.colorSpace) {
      texture.colorSpace = colorSpace;
      texture.needsUpdate = true;
    }

    if (floatMode) {
      // FLOAT texture handling (gradient & colorMap)
      // type of image.data is Uint8ClampedArray, but it is in fact the raw texture data even thought it's
      // meant to be used as an RGBA image data array
      const valueData = texture.image.data as unknown as Float32Array;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const offset = y * row_stride + x * cell_stride;
          const colorValue = fieldReader(view, offset);
          const i = y * cols + x;
          valueData[i] = colorValue;
        }
      }
    } else {
      // RGBA textures (flat & rgba modes)
      const rgba = texture.image.data;
      let hasTransparency = false;
      if (settings.colorMode === "rgba-fields") {
        this.#getRgbaFieldReaders(tempRgbaFieldReaders, foxgloveGrid);
        const { redReader, greenReader, blueReader, alphaReader } = tempRgbaFieldReaders;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const offset = y * row_stride + x * cell_stride;
            const i = y * cols + x;
            const rgbaOffset = i * 4;
            const alpha = alphaReader(view, offset);
            rgba[rgbaOffset + 0] = (redReader(view, offset) * 255) | 0;
            rgba[rgbaOffset + 1] = (greenReader(view, offset) * 255) | 0;
            rgba[rgbaOffset + 2] = (blueReader(view, offset) * 255) | 0;
            rgba[rgbaOffset + 3] = (alpha * 255) | 0;

            // We cheat a little with transparency: alpha 0 will be handled by the alphaTest setting, so
            // we don't need to set material.transparent = true.
            if (alpha !== 0 && alpha !== 1) {
              hasTransparency = true;
            }
          }
        }
      } else if (settings.colorMode === "flat") {
        // flat
        const colorConverter = getColorConverter(
          settings as typeof settings & { colorMode: typeof settings.colorMode },
          0,
          1,
        );
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const offset = y * row_stride + x * cell_stride;
            const colorValue = fieldReader(view, offset);
            colorConverter(tempColor, colorValue);
            const i = y * cols + x;
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
        }
      }
      if (this.userData.material.transparent !== hasTransparency) {
        this.userData.material.transparent = hasTransparency;
        this.userData.material.depthWrite = !hasTransparency;
        this.userData.material.needsUpdate = true;
      }
    }
    this.userData.material.uniforms.map.value.needsUpdate = true;
  }
}

export class FoxgloveGrid extends SceneExtension<FoxgloveGridRenderable> {
  public static extensionId = "foxglove.Grid";
  #fieldsByTopic = new Map<string, string[]>();

  public constructor(renderer: IRenderer, name: string = FoxgloveGrid.extensionId) {
    super(name, renderer);
  }

  public override getSubscriptions(): readonly AnyRendererSubscription[] {
    return [
      {
        type: "schema",
        schemaNames: GRID_DATATYPES,
        subscription: { handler: this.#handleFoxgloveGrid, filterQueue: onlyLastByTopicMessage },
      },
    ];
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const topic of this.renderer.topics ?? []) {
      if (!topicIsConvertibleToSchema(topic, GRID_DATATYPES)) {
        continue;
      }
      const config = (configTopics[topic.name] ?? {}) as Partial<LayerSettingsFoxgloveGrid>;

      const colorModeFields = colorModeSettingsFields({
        msgFields: this.#fieldsByTopic.get(topic.name),
        config,
        defaults: DEFAULT_SETTINGS,
        modifiers: { supportsPackedRgbModes: false, supportsRgbaFieldsMode: true },
      });

      const node: SettingsTreeNodeWithActionHandler = {
        order: topic.name.toLocaleLowerCase(),
        icon: "Cells",
        visible: config.visible ?? DEFAULT_SETTINGS.visible,
        fields: {
          ...colorModeFields,
          frameLocked: {
            label: "Frame lock",
            input: "boolean",
            value: config.frameLocked ?? DEFAULT_SETTINGS.frameLocked,
          },
        },
        handler,
      };

      entries.push({
        path: ["topics", topic.name],
        node,
      });
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

      renderable.updateMaterial(renderable.userData.settings);
      renderable.updateUniforms(renderable.userData.foxgloveGrid, renderable.userData.settings);
      if (
        action.payload.path[2] === "colorMode" ||
        action.payload.path[2] === "colorField" ||
        action.payload.path[2] === "flatColor"
      ) {
        // needs to recalculate texture when colorMode or colorField changes
        // technically it doesn't if it's going between gradient and colorMap, but since it's an infrequent user-action it's not a big hit
        renderable.updateTexture(renderable.userData.foxgloveGrid, renderable.userData.settings);
      }
      renderable.syncPickingMaterial();
    }
  };

  #handleFoxgloveGrid = (messageEvent: PartialMessageEvent<Grid>): void => {
    const topic = messageEvent.topic;
    const foxgloveGrid = normalizeFoxgloveGrid(messageEvent.message);
    const receiveTime = toNanoSec(messageEvent.receiveTime);

    let renderable = this.renderables.get(topic);

    if (!this.#validateFoxgloveGrid(foxgloveGrid, messageEvent.topic)) {
      if (renderable) {
        renderable.visible = false;
      }
      return;
    }

    if (renderable) {
      renderable.visible = true;
    } else {
      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsFoxgloveGrid>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...userSettings };
      // only want to autoselect if it's in flatcolor mode (without colorfield) and previously didn't have fields
      if (settings.colorField == undefined && this.#fieldsByTopic.get(topic) == undefined) {
        autoSelectColorField(settings, foxgloveGrid.fields, { supportsPackedRgbModes: false });
        // Update user settings with the newly selected color field
        this.renderer.updateConfig((draft) => {
          const updatedUserSettings = { ...userSettings };
          updatedUserSettings.colorField = settings.colorField;
          updatedUserSettings.colorMode = settings.colorMode;
          updatedUserSettings.colorMap = settings.colorMap;
          draft.topics[topic] = updatedUserSettings;
        });
      }

      // Check color
      const texture = createTexture(foxgloveGrid, settings);
      const geometry = this.renderer.sharedGeometry.getGeometry(
        this.constructor.name,
        createGridGeometry,
      );
      const mesh = createMesh(topic, texture, geometry);
      const material = mesh.material as GridShaderMaterial;
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

    let fields = this.#fieldsByTopic.get(topic);
    if (!fields || fields.length !== foxgloveGrid.fields.length) {
      fields = foxgloveGrid.fields.map((field) => field.name);
      this.#fieldsByTopic.set(topic, fields);
      this.updateSettingsTree();
    }

    this.#updateFoxgloveGridRenderable(
      renderable,
      foxgloveGrid,
      receiveTime,
      renderable.userData.settings,
    );
  };

  #validateFoxgloveGrid(foxgloveGrid: Grid, topic: string): boolean {
    const { cell_stride, row_stride, column_count: cols } = foxgloveGrid;
    const rows = foxgloveGrid.data.byteLength / row_stride;

    if (foxgloveGrid.fields.length === 0) {
      invalidFoxgloveGridError(
        this.renderer,
        topic,
        `Grid has no fields. At least one field is required for the Grid to be displayed.`,
      );
      return false;
    }

    if (Math.floor(cols) !== cols || Math.floor(rows) !== rows) {
      const message = `Grid column count (${foxgloveGrid.column_count}) or row count (${rows} = data.byteLength ${foxgloveGrid.data.byteLength} / row_stride ${row_stride}) is not an integer.`;
      invalidFoxgloveGridError(this.renderer, topic, message);
      return false;
    }

    if (cell_stride * cols > row_stride) {
      const message = `Grid row_stride (${row_stride}) does not allow for requisite column_count (${cols}) with cell stride (${cell_stride}). Minimum requisite bytes in row_stride needed: (${
        cols * cell_stride
      }) `;
      invalidFoxgloveGridError(this.renderer, topic, message);
      return false;
    }

    // Determine the minimum bytes needed per cell based on offset/size of each
    // field, so we can ensure cell_stride is >= this value
    let minBytesPerCell = 0;
    let maxField: PackedElementField | undefined;
    for (const field of foxgloveGrid.fields) {
      const byteWidth = numericTypeWidth(field.type);
      if (field.offset + byteWidth > minBytesPerCell) {
        minBytesPerCell = field.offset + byteWidth;
        maxField = field;
      }
    }
    if (minBytesPerCell > cell_stride) {
      let message = `Grid cell_stride (${cell_stride}) is less than minimum bytes per cell (${minBytesPerCell})`;
      if (maxField) {
        message += ` required by “${maxField.name}” field, type=${numericTypeName(
          maxField.type,
        )}, offset=${maxField.offset}`;
      }
      invalidFoxgloveGridError(this.renderer, topic, message);
      return false;
    }

    return true;
  }

  /** @param foxgloveGrid must be validated already */
  #updateFoxgloveGridRenderable(
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
    const { row_stride, column_count: cols } = foxgloveGrid;
    const rows = foxgloveGrid.data.byteLength / row_stride;

    renderable.updateMaterial(settings);
    renderable.updateUniforms(foxgloveGrid, settings);
    renderable.updateTexture(foxgloveGrid, settings);

    renderable.scale.set(foxgloveGrid.cell_size.x * cols, foxgloveGrid.cell_size.y * rows, 1);

    renderable.syncPickingMaterial();
  }
}
function createGridGeometry(): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  geometry.translate(0.5, 0.5, 0);
  geometry.computeBoundingSphere();
  return geometry;
}

function invalidFoxgloveGridError(renderer: IRenderer, topic: string, message: string): void {
  renderer.settings.errors.addToTopic(topic, INVALID_FOXGLOVE_GRID, message);
}

function createTexture(foxgloveGrid: Grid, settings: GridColorModeSettings): THREE.DataTexture {
  const { column_count: cols, row_stride } = foxgloveGrid;
  const rows = foxgloveGrid.data.byteLength / row_stride;
  const size = isFinite(cols * rows) ? cols * rows : 0;
  const isFloatType = floatTextureColorModes.includes(settings.colorMode);
  const data = isFloatType ? new Float32Array(size) : new Uint8ClampedArray(size * 4);
  const format = isFloatType ? THREE.RedFormat : THREE.RGBAFormat;
  const type = isFloatType ? THREE.FloatType : THREE.UnsignedByteType;
  const texture = new THREE.DataTexture(
    data,
    cols,
    rows,
    format,
    type,
    THREE.UVMapping,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.NearestFilter,
    THREE.LinearFilter,
    1,
    getTextureColorSpace(settings),
  );
  texture.generateMipmaps = false;
  return texture;
}

function createMesh(
  topic: string,
  texture: THREE.DataTexture,
  geometry: THREE.PlaneGeometry,
): THREE.Mesh {
  // Create the texture, material, and mesh
  const material = createMaterial(texture, topic);
  const pickingMaterial = createPickingMaterial(material);
  const mesh = new THREE.Mesh(geometry, material);
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

function createMaterial(texture: THREE.DataTexture, topic: string): GridShaderMaterial {
  return new THREE.ShaderMaterial({
    name: `${topic}:Material`,
    // Enable alpha clipping. Fully transparent (alpha=0) pixels are skipped
    // even when transparency is disabled
    alphaTest: 1e-4,
    side: THREE.DoubleSide,
    uniforms: {
      objectId: { value: [NaN, NaN, NaN, NaN] },
      colorMode: { value: COLOR_MODE_TO_GLSL.COLOR_MODE_RGBA },
      colorMap: { value: COLOR_MAP_TO_GLSL.COLOR_MAP_TURBO },
      colorMapOpacity: { value: 1.0 },
      minValue: { value: 0.0 },
      maxValue: { value: 1.0 },
      minGradientColorLinear: { value: new THREE.Vector4() },
      maxGradientColorLinear: { value: new THREE.Vector4() },
      map: { value: texture },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    defines: {
      ...COLOR_MODE_TO_GLSL,
      ...COLOR_MAP_TO_GLSL,
      PICKING: 0,
    },
    fragmentShader: /* glsl */ `
      uniform vec4 objectId;

      uniform sampler2D map;

      uniform int colorMode;
      uniform float minValue;
      uniform float maxValue;

      uniform int colorMap;
      uniform float colorMapOpacity;

      uniform vec4 minGradientColorLinear;
      uniform vec4 maxGradientColorLinear;

      varying vec2 vUv;

      ${FS_SRGB_TO_LINEAR}

      // adapted from https://gist.github.com/mikhailov-work/0d177465a8151eb6ede1768d51d476c7
      vec3 turboLinear(float x) {
        const vec4 kRedVec4 = vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234);
        const vec4 kGreenVec4 = vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333);
        const vec4 kBlueVec4 = vec4(0.10667330, 12.64194608, -60.58204836, 110.36276771);
        const vec2 kRedVec2 = vec2(-152.94239396, 59.28637943);
        const vec2 kGreenVec2 = vec2(4.27729857, 2.82956604);
        const vec2 kBlueVec2 = vec2(-89.90310912, 27.34824973);

        vec4 v4 = vec4(1.0, x, x * x, x * x * x);
        vec2 v2 = v4.zw * v4.z;
        return sRGBToLinear(vec3(
          (dot(v4, kRedVec4)   + dot(v2, kRedVec2)),
          (dot(v4, kGreenVec4) + dot(v2, kGreenVec2)),
          (dot(v4, kBlueVec4)  + dot(v2, kBlueVec2))
        ));
      }


      // taken from http://docs.ros.org/jade/api/rviz/html/c++/point__cloud__transformers_8cpp_source.html
      // line 47
      vec3 rainbowLinear(float pct) {
        vec3 colorOut = vec3(0.0);
        float h = (1.0 - clamp(pct, 0.0, 1.0)) * 5.0 + 1.0;
        float i = floor(h);
        float f = mod(h, 1.0);
        // if i is even
        if (mod(i, 2.0) < 1.0) {
          f = 1.0 - f;
        }
        float n = (1.0 - f);

        if (i <= 1.0) {
          colorOut.r = n;
          colorOut.g = 0.0;
          colorOut.b = 1.0;
        } else if (i == 2.0) {
          colorOut.r = 0.0;
          colorOut.g = n;
          colorOut.b = 1.0;
        } else if (i == 3.0) {
          colorOut.r = 0.0;
          colorOut.g = 1.0;
          colorOut.b = n;
        } else if (i == 4.0) {
          colorOut.r = n;
          colorOut.g = 1.0;
          colorOut.b = 0.0;
        } else {
          colorOut.r = 1.0;
          colorOut.g = n;
          colorOut.b = 0.0;
        }
        return sRGBToLinear(colorOut);
      }

      void main() {
        vec4 color = texture2D(map, vUv);
        if(colorMode == COLOR_MODE_RGBA) {
          // input color is in sRGB, texture.colorSpace is sRGB, so no conversion is needed
          gl_FragColor = color;
        } else if (colorMode == COLOR_MODE_FLAT) {
          // input color was already converted to linear by getColorConverter
          gl_FragColor = color;
        } else {
          // input color was already converted to linear by getColorConverter
          float delta = max(maxValue - minValue, 0.00001);
          float colorValue = color.r;
          float normalizedColorValue = clamp((colorValue - minValue) / delta, 0.0, 1.0);
          if(colorMode == COLOR_MODE_GRADIENT) {
            /**
            * Computes a gradient step from colors a to b using pre-multiplied alpha to
            * match CSS linear gradients. The inputs are assumed to not have pre-multiplied
            * alpha, and the output will have pre-multiplied alpha.
            */
            vec4 weightedMinColor = vec4(minGradientColorLinear.rgb * minGradientColorLinear.a, minGradientColorLinear.a);
            vec4 weightedMaxColor = vec4(maxGradientColorLinear.rgb * maxGradientColorLinear.a, maxGradientColorLinear.a);
            vec4 finalColor = mix(weightedMinColor, weightedMaxColor, normalizedColorValue);
            // gradient computation takes place in linear colorspace
            gl_FragColor = finalColor;
          } else if(colorMode == COLOR_MODE_COLORMAP) {
            // colormap
            if(colorMap == COLOR_MAP_TURBO) {
              gl_FragColor = vec4(turboLinear(normalizedColorValue), colorMapOpacity);
            } else if(colorMap == COLOR_MAP_RAINBOW) {
              gl_FragColor = vec4(rainbowLinear(normalizedColorValue), colorMapOpacity);
            }
          }
        }
        if(gl_FragColor.a < 0.00001) {
          discard;
        }
        if(PICKING == 1) {
          gl_FragColor = objectId;
        } else {
          #include <colorspace_fragment>
        }
      }
    `,
  }) as GridShaderMaterial;
}

function createPickingMaterial(originalMaterial: GridShaderMaterial): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial();
  material.copy(originalMaterial);
  material.name = "";
  material.defines.PICKING = 1;
  material.uniformsNeedUpdate = true;
  material.needsUpdate = true;
  return material;
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
  if (!NEEDS_MIN_MAX.includes(settings.colorMode)) {
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

function autoSelectColorField<Settings extends ColorModeSettings>(
  output: Settings,
  fields: PackedElementField[],
  { supportsPackedRgbModes }: { supportsPackedRgbModes: boolean },
): void {
  // Prefer color fields first
  if (supportsPackedRgbModes) {
    for (const field of fields) {
      const fieldNameLower = field.name.toLowerCase();
      if (RGBA_PACKED_FIELDS.has(fieldNameLower)) {
        output.colorField = field.name;
        switch (fieldNameLower) {
          case "rgb":
            output.colorMode = "rgb";
            break;
          default:
          case "rgba":
            output.colorMode = "rgba";
            break;
        }
        return;
      }
    }
  }

  if (hasSeparateRgbaFields(fields.map((f) => f.name))) {
    output.colorMode = "rgba-fields";
    return;
  }

  // Fall back to using the first field
  if (fields.length > 0) {
    const firstField = fields[0]!;
    output.colorField = firstField.name;
    output.colorMode = "colormap";
    output.colorMap = "turbo";
    return;
  }
}
