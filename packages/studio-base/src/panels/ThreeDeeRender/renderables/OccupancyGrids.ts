// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";
import { SettingsTreeAction, SettingsTreeFields } from "@foxglove/studio";
import type { RosValue } from "@foxglove/studio-base/players/types";

import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { PartialMessage, PartialMessageEvent, SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { rgbaToCssString, SRGBToLinear, stringToRgba } from "../color";
import {
  normalizeHeader,
  normalizePose,
  normalizeInt8Array,
  normalizeTime,
} from "../normalizeMessages";
import { ColorRGBA, OccupancyGrid, OCCUPANCY_GRID_DATATYPES } from "../ros";
import { BaseSettings } from "../settings";
import { topicIsConvertibleToSchema } from "../topicIsConvertibleToSchema";

type ColorModes = "custom" | "costmap";

export type LayerSettingsOccupancyGrid = BaseSettings & {
  frameLocked: boolean;
  minColor: string;
  maxColor: string;
  unknownColor: string;
  invalidColor: string;
  colorMode: ColorModes;
};

const INVALID_OCCUPANCY_GRID = "INVALID_OCCUPANCY_GRID";

const DEFAULT_MIN_COLOR = { r: 1, g: 1, b: 1, a: 1 }; // white
const DEFAULT_MAX_COLOR = { r: 0, g: 0, b: 0, a: 1 }; // black
const DEFAULT_UNKNOWN_COLOR = { r: 0.5, g: 0.5, b: 0.5, a: 1 }; // gray
const DEFAULT_INVALID_COLOR = { r: 1, g: 0, b: 1, a: 1 }; // magenta

const DEFAULT_MIN_COLOR_STR = rgbaToCssString(DEFAULT_MIN_COLOR);
const DEFAULT_MAX_COLOR_STR = rgbaToCssString(DEFAULT_MAX_COLOR);
const DEFAULT_UNKNOWN_COLOR_STR = rgbaToCssString(DEFAULT_UNKNOWN_COLOR);
const DEFAULT_INVALID_COLOR_STR = rgbaToCssString(DEFAULT_INVALID_COLOR);

const DEFAULT_SETTINGS: LayerSettingsOccupancyGrid = {
  visible: false,
  frameLocked: false,
  colorMode: "custom",
  minColor: DEFAULT_MIN_COLOR_STR,
  maxColor: DEFAULT_MAX_COLOR_STR,
  unknownColor: DEFAULT_UNKNOWN_COLOR_STR,
  invalidColor: DEFAULT_INVALID_COLOR_STR,
};

export type OccupancyGridUserData = BaseUserData & {
  settings: LayerSettingsOccupancyGrid;
  topic: string;
  occupancyGrid: OccupancyGrid;
  mesh: THREE.Mesh;
  texture: THREE.DataTexture;
  material: THREE.MeshBasicMaterial;
  pickingMaterial: THREE.ShaderMaterial;
};

export class OccupancyGridRenderable extends Renderable<OccupancyGridUserData> {
  public override dispose(): void {
    this.userData.texture.dispose();
    this.userData.material.dispose();
    this.userData.pickingMaterial.dispose();
  }

  public override details(): Record<string, RosValue> {
    return this.userData.occupancyGrid;
  }
}

export class OccupancyGrids extends SceneExtension<OccupancyGridRenderable> {
  public constructor(renderer: Renderer) {
    super("foxglove.OccupancyGrids", renderer);

    renderer.addSchemaSubscriptions(OCCUPANCY_GRID_DATATYPES, this.handleOccupancyGrid);
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const topic of this.renderer.topics ?? []) {
      if (!topicIsConvertibleToSchema(topic, OCCUPANCY_GRID_DATATYPES)) {
        continue;
      }
      const config = (configTopics[topic.name] ?? {}) as Partial<LayerSettingsOccupancyGrid>;

      let fields: SettingsTreeFields = {
        colorMode: {
          label: "Color mode",
          input: "select",
          value: config.colorMode ?? "custom",
          options: [
            { label: "Custom", value: "custom" },
            { label: "Costmap", value: "costmap" },
          ],
        },
      };

      if (config.colorMode === "custom") {
        // prettier-ignore
        const customFields: SettingsTreeFields = {
          minColor: { label: "Min Color", input: "rgba", value: config.minColor ?? DEFAULT_MIN_COLOR_STR },
          maxColor: { label: "Max Color", input: "rgba", value: config.maxColor ?? DEFAULT_MAX_COLOR_STR },
          unknownColor: { label: "Unknown Color", input: "rgba", value: config.unknownColor ?? DEFAULT_UNKNOWN_COLOR_STR },
          invalidColor: { label: "Invalid Color", input: "rgba", value: config.invalidColor ?? DEFAULT_INVALID_COLOR_STR },
          frameLocked: { label: "Frame Lock", input: "boolean", value: config.frameLocked ?? false },
        };
        fields = {
          ...fields,
          ...customFields,
        };
      }

      entries.push({
        path: ["topics", topic.name],
        node: {
          label: topic.name,
          icon: "Cells",
          fields,
          visible: config.visible ?? DEFAULT_SETTINGS.visible,
          order: topic.name.toLocaleLowerCase(),
          handler,
        },
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
      const prevTransparent = occupancyGridHasTransparency(renderable.userData.settings);
      const settings = this.renderer.config.topics[topicName] as
        | Partial<LayerSettingsOccupancyGrid>
        | undefined;
      renderable.userData.settings = { ...DEFAULT_SETTINGS, ...settings };

      // Check if the transparency changed and we need to create a new material
      const newTransparent = occupancyGridHasTransparency(renderable.userData.settings);
      if (prevTransparent !== newTransparent) {
        renderable.userData.material.transparent = newTransparent;
        renderable.userData.material.depthWrite = !newTransparent;
        renderable.userData.material.needsUpdate = true;
      }

      this._updateOccupancyGridRenderable(
        renderable,
        renderable.userData.occupancyGrid,
        renderable.userData.receiveTime,
      );
    }
  };

  private handleOccupancyGrid = (messageEvent: PartialMessageEvent<OccupancyGrid>): void => {
    const topic = messageEvent.topic;
    const occupancyGrid = normalizeOccupancyGrid(messageEvent.message);
    const receiveTime = toNanoSec(messageEvent.receiveTime);

    let renderable = this.renderables.get(topic);
    if (!renderable) {
      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsOccupancyGrid>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...userSettings };

      const texture = createTexture(occupancyGrid);
      const geometry = this.renderer.sharedGeometry.getGeometry(
        this.constructor.name,
        createGeometry,
      );
      const mesh = createMesh(topic, geometry, texture, settings);
      const material = mesh.material as THREE.MeshBasicMaterial;
      const pickingMaterial = mesh.userData.pickingMaterial as THREE.ShaderMaterial;

      // Create the renderable
      renderable = new OccupancyGridRenderable(topic, this.renderer, {
        receiveTime,
        messageTime: toNanoSec(occupancyGrid.header.stamp),
        frameId: this.renderer.normalizeFrameId(occupancyGrid.header.frame_id),
        pose: occupancyGrid.info.origin,
        settingsPath: ["topics", topic],
        settings,
        topic,
        occupancyGrid,
        mesh,
        texture,
        material,
        pickingMaterial,
      });
      renderable.add(mesh);

      this.add(renderable);
      this.renderables.set(topic, renderable);
    }

    this._updateOccupancyGridRenderable(renderable, occupancyGrid, receiveTime);
  };

  private _updateOccupancyGridRenderable(
    renderable: OccupancyGridRenderable,
    occupancyGrid: OccupancyGrid,
    receiveTime: bigint,
  ): void {
    renderable.userData.occupancyGrid = occupancyGrid;
    renderable.userData.pose = occupancyGrid.info.origin;
    renderable.userData.receiveTime = receiveTime;
    renderable.userData.messageTime = toNanoSec(occupancyGrid.header.stamp);
    renderable.userData.frameId = this.renderer.normalizeFrameId(occupancyGrid.header.frame_id);

    const size = occupancyGrid.info.width * occupancyGrid.info.height;
    if (occupancyGrid.data.length !== size) {
      const message = `OccupancyGrid data length (${occupancyGrid.data.length}) is not equal to width ${occupancyGrid.info.width} * height ${occupancyGrid.info.height}`;
      invalidOccupancyGridError(this.renderer, renderable, message);
      return;
    }

    let texture = renderable.userData.texture;
    const width = occupancyGrid.info.width;
    const height = occupancyGrid.info.height;
    const resolution = occupancyGrid.info.resolution;

    if (width !== texture.image.width || height !== texture.image.height) {
      // The image dimensions changed, regenerate the texture
      texture.dispose();
      texture = createTexture(occupancyGrid);
      renderable.userData.texture = texture;
      renderable.userData.material.map = texture;
    }

    // Update the occupancy grid texture
    updateTexture(texture, occupancyGrid, renderable.userData.settings);

    renderable.scale.set(resolution * width, resolution * height, 1);
  }
}
function createGeometry(): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
  geometry.translate(0.5, 0.5, 0);
  geometry.computeBoundingSphere();
  return geometry;
}
function invalidOccupancyGridError(
  renderer: Renderer,
  renderable: OccupancyGridRenderable,
  message: string,
): void {
  renderer.settings.errors.addToTopic(renderable.userData.topic, INVALID_OCCUPANCY_GRID, message);
}

function createTexture(occupancyGrid: OccupancyGrid): THREE.DataTexture {
  const width = occupancyGrid.info.width;
  const height = occupancyGrid.info.height;
  const size = width * height;
  const rgba = new Uint8ClampedArray(size * 4);
  const texture = new THREE.DataTexture(
    rgba,
    width,
    height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
    THREE.UVMapping,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.NearestFilter,
    THREE.LinearFilter,
    1,
    THREE.LinearEncoding, // OccupancyGrid carries linear grayscale values, not sRGB
  );
  texture.generateMipmaps = false;
  return texture;
}

function createMesh(
  topic: string,
  geometry: THREE.PlaneGeometry,
  texture: THREE.DataTexture,
  settings: LayerSettingsOccupancyGrid,
): THREE.Mesh {
  // Create the texture, material, and mesh
  const pickingMaterial = createPickingMaterial(texture);
  const material = createMaterial(texture, topic, settings);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // This overrides the picking material used for `mesh`. See Picker.ts
  mesh.userData.pickingMaterial = pickingMaterial;
  return mesh;
}

const tempColor = { r: 0, g: 0, b: 0, a: 0 };
const tempUnknownColor = { r: 0, g: 0, b: 0, a: 0 };
const tempInvalidColor = { r: 0, g: 0, b: 0, a: 0 };
const tempMinColor = { r: 0, g: 0, b: 0, a: 0 };
const tempMaxColor = { r: 0, g: 0, b: 0, a: 0 };

function updateTexture(
  texture: THREE.DataTexture,
  occupancyGrid: OccupancyGrid,
  settings: LayerSettingsOccupancyGrid,
): void {
  const size = occupancyGrid.info.width * occupancyGrid.info.height;
  const rgba = texture.image.data;
  stringToRgba(tempMinColor, settings.minColor);
  stringToRgba(tempMaxColor, settings.maxColor);
  stringToRgba(tempUnknownColor, settings.unknownColor);
  stringToRgba(tempInvalidColor, settings.invalidColor);

  srgbToLinearUint8(tempMinColor);
  srgbToLinearUint8(tempMaxColor);
  srgbToLinearUint8(tempUnknownColor);
  srgbToLinearUint8(tempInvalidColor);

  const data = occupancyGrid.data;
  for (let i = 0; i < size; i++) {
    const value = data[i]! | 0;
    const offset = i * 4;
    if (settings.colorMode === "custom") {
      if (value === -1) {
        // Unknown (-1)
        rgba[offset + 0] = tempUnknownColor.r;
        rgba[offset + 1] = tempUnknownColor.g;
        rgba[offset + 2] = tempUnknownColor.b;
        rgba[offset + 3] = tempUnknownColor.a;
      } else if (value >= 0 && value <= 100) {
        // Valid [0-100]
        const t = value / 100;

        rgba[offset + 0] = tempMinColor.r + (tempMaxColor.r - tempMinColor.r) * t;
        rgba[offset + 1] = tempMinColor.g + (tempMaxColor.g - tempMinColor.g) * t;
        rgba[offset + 2] = tempMinColor.b + (tempMaxColor.b - tempMinColor.b) * t;
        rgba[offset + 3] = tempMinColor.a + (tempMaxColor.a - tempMinColor.a) * t;
      } else {
        // Invalid (< -1 or > 100)
        rgba[offset + 0] = tempInvalidColor.r;
        rgba[offset + 1] = tempInvalidColor.g;
        rgba[offset + 2] = tempInvalidColor.b;
        rgba[offset + 3] = tempInvalidColor.a;
      }
    } else {
      costmapColorCached(tempColor, value);
      rgba[offset + 0] = tempColor.r;
      rgba[offset + 1] = tempColor.g;
      rgba[offset + 2] = tempColor.b;
      rgba[offset + 3] = tempColor.a;
    }
  }

  texture.needsUpdate = true;
}

function createMaterial(
  texture: THREE.DataTexture,
  topic: string,
  settings: LayerSettingsOccupancyGrid,
): THREE.MeshBasicMaterial {
  const transparent = occupancyGridHasTransparency(settings);
  return new THREE.MeshBasicMaterial({
    name: `${topic}:Material`,
    // Enable alpha clipping. Fully transparent (alpha=0) pixels are skipped
    // even when transparency is disabled
    alphaTest: 1e-4,
    depthWrite: !transparent,
    map: texture,
    side: THREE.DoubleSide,
    transparent,
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

function occupancyGridHasTransparency(settings: LayerSettingsOccupancyGrid): boolean {
  if (settings.colorMode === "costmap") {
    return true;
  } else {
    stringToRgba(tempMinColor, settings.minColor);
    stringToRgba(tempMaxColor, settings.maxColor);
    stringToRgba(tempUnknownColor, settings.unknownColor);
    stringToRgba(tempInvalidColor, settings.invalidColor);
    return (
      tempMinColor.a < 1 || tempMaxColor.a < 1 || tempInvalidColor.a < 1 || tempUnknownColor.a < 1
    );
  }
}

function srgbToLinearUint8(color: ColorRGBA): void {
  color.r = Math.trunc(SRGBToLinear(color.r) * 255);
  color.g = Math.trunc(SRGBToLinear(color.g) * 255);
  color.b = Math.trunc(SRGBToLinear(color.b) * 255);
  color.a = Math.trunc(color.a * 255);
}

function normalizeOccupancyGrid(message: PartialMessage<OccupancyGrid>): OccupancyGrid {
  const info = message.info ?? {};

  return {
    header: normalizeHeader(message.header),
    info: {
      map_load_time: normalizeTime(info.map_load_time),
      resolution: info.resolution ?? 0,
      width: info.width ?? 0,
      height: info.height ?? 0,
      origin: normalizePose(info.origin),
    },
    data: normalizeInt8Array(message.data),
  };
}

let costmapPalette: [number, number, number, number][] | undefined;

function costmapColorCached(output: ColorRGBA, value: number) {
  const unsignedValue = value >= 0 ? value : value + 255;
  if (unsignedValue < 0 || unsignedValue > 255) {
    output.r = 0;
    output.g = 0;
    output.b = 0;
    output.a = 0;
  }
  if (!costmapPalette) {
    costmapPalette = createCostmapPalette();
  }

  const colorRaw = costmapPalette[Math.trunc(unsignedValue)]!;
  output.r = colorRaw[0];
  output.g = colorRaw[1];
  output.b = colorRaw[2];
  output.a = colorRaw[3];
}

// Based off of rviz costmap implementation
// https://github.com/ros-visualization/rviz/blob/1f622b8c95b8e188841b5505db2f97394d3e9c6c/src/rviz/default_plugin/map_display.cpp#L322
function createCostmapPalette() {
  let index = 0;
  const palette = new Array(256).fill([0, 0, 0, 0]);
  // zero values have alpha=0
  palette[index++] = [0, 0, 0, 0];

  // Blue to red spectrum for most normal cost values
  for (let i = 1; i <= 98; i++) {
    const v = (255 * i) / 100;
    palette[index++] = [v, 0, 255 - v, 255];
  }
  // inscribed obstacle values (99) in cyan
  palette[index++] = [0, 255, 255, 255];

  // lethal obstacle values (100) in purple
  palette[index++] = [255, 0, 255, 255];

  // illegal positive values in green
  for (let i = 101; i <= 127; i++) {
    palette[index++] = [0, 255, 0, 255];
  }

  // illegal negative (char) values in shades of red/yellow
  for (let i = 128; i <= 254; i++) {
    palette[index++] = [255, Math.trunc((255 * (i - 128)) / (254 - 128)), 0, 255];
  }

  // legal -1 value is tasteful blueish greenish grayish color
  palette[index++] = [112, 137, 134, 255];
  return palette;
}
