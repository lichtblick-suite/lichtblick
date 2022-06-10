// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";

import { Renderer } from "../Renderer";
import { rgbaToCssString, SRGBToLinear, stringToRgba } from "../color";
import { Pose, ColorRGBA, OccupancyGrid } from "../ros";
import { LayerSettingsOccupancyGrid, LayerType } from "../settings";
import { updatePose } from "../updatePose";
import { missingTransformMessage, MISSING_TRANSFORM } from "./transforms";

// TODO(jhurliman): Upload the OccupancyGrid data directly as a R8I texture and
// use a custom ShaderMaterial with an isampler2D uniform to reimplement the
// updateTexture() logic in a shader

const INVALID_OCCUPANCY_GRID = "INVALID_OCCUPANCY_GRID";

const DEFAULT_MIN_COLOR = { r: 1, g: 1, b: 1, a: 0.5 }; // white
const DEFAULT_MAX_COLOR = { r: 0, g: 0, b: 0, a: 0.5 }; // black
const DEFAULT_UNKNOWN_COLOR = { r: 0.5, g: 0.5, b: 0.5, a: 0.5 }; // gray
const DEFAULT_INVALID_COLOR = { r: 1, g: 0, b: 1, a: 1 }; // magenta

const DEFAULT_MIN_COLOR_STR = rgbaToCssString(DEFAULT_MIN_COLOR);
const DEFAULT_MAX_COLOR_STR = rgbaToCssString(DEFAULT_MAX_COLOR);
const DEFAULT_UNKNOWN_COLOR_STR = rgbaToCssString(DEFAULT_UNKNOWN_COLOR);
const DEFAULT_INVALID_COLOR_STR = rgbaToCssString(DEFAULT_INVALID_COLOR);

const DEFAULT_SETTINGS: LayerSettingsOccupancyGrid = {
  visible: true,
  minColor: DEFAULT_MIN_COLOR_STR,
  maxColor: DEFAULT_MAX_COLOR_STR,
  unknownColor: DEFAULT_UNKNOWN_COLOR_STR,
  invalidColor: DEFAULT_INVALID_COLOR_STR,
  frameLocked: true,
};

type OccupancyGridRenderable = Omit<THREE.Object3D, "userData"> & {
  userData: {
    topic: string;
    settings: LayerSettingsOccupancyGrid;
    occupancyGrid: OccupancyGrid;
    pose: Pose;
    srcTime: bigint;
    mesh: THREE.Mesh;
    texture: THREE.DataTexture;
    material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
  };
};

export class OccupancyGrids extends THREE.Object3D {
  private static geometry: THREE.PlaneGeometry | undefined;

  renderer: Renderer;
  occupancyGridsByTopic = new Map<string, OccupancyGridRenderable>();

  constructor(renderer: Renderer) {
    super();
    this.renderer = renderer;

    renderer.setSettingsNodeProvider(LayerType.OccupancyGrid, (topicConfig) => {
      const cur = topicConfig as Partial<LayerSettingsOccupancyGrid>;
      const minColor = cur.minColor ?? DEFAULT_MIN_COLOR_STR;
      const maxColor = cur.maxColor ?? DEFAULT_MAX_COLOR_STR;
      const unknownColor = cur.unknownColor ?? DEFAULT_UNKNOWN_COLOR_STR;
      const invalidColor = cur.invalidColor ?? DEFAULT_INVALID_COLOR_STR;
      const frameLocked = cur.frameLocked ?? false;
      return {
        icon: "Cells",
        fields: {
          minColor: { label: "Min Color", input: "rgba", value: minColor },
          maxColor: { label: "Max Color", input: "rgba", value: maxColor },
          unknownColor: { label: "Unknown Color", input: "rgba", value: unknownColor },
          invalidColor: { label: "Invalid Color", input: "rgba", value: invalidColor },
          frameLocked: { label: "Frame lock", input: "boolean", value: frameLocked },
        },
      };
    });
  }

  dispose(): void {
    for (const renderable of this.occupancyGridsByTopic.values()) {
      renderable.userData.texture.dispose();
      renderable.userData.material.dispose();
      const pickingMaterial = renderable.userData.mesh.userData
        .pickingMaterial as THREE.ShaderMaterial;
      pickingMaterial.dispose();
    }
    this.children.length = 0;
    this.occupancyGridsByTopic.clear();
  }

  addOccupancyGridMessage(topic: string, occupancyGrid: OccupancyGrid): void {
    let renderable = this.occupancyGridsByTopic.get(topic);
    if (!renderable) {
      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsOccupancyGrid>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...userSettings };

      // Create the texture, material, and mesh
      const texture = createTexture(occupancyGrid);
      const material = createMaterial(texture, topic, settings);
      const mesh = new THREE.Mesh(OccupancyGrids.Geometry(), material);
      mesh.userData.pickingMaterial = createPickingMaterial(texture);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // Create the renderable
      renderable = new THREE.Object3D() as OccupancyGridRenderable;
      renderable.name = topic;
      renderable.userData = {
        topic,
        settings,
        occupancyGrid,
        pose: occupancyGrid.info.origin,
        srcTime: toNanoSec(occupancyGrid.header.stamp),
        mesh,
        texture,
        material,
      };
      renderable.add(mesh);

      this.add(renderable);
      this.occupancyGridsByTopic.set(topic, renderable);
    }

    this._updateOccupancyGridRenderable(renderable, occupancyGrid);
  }

  setTopicSettings(topic: string, settings: Partial<LayerSettingsOccupancyGrid>): void {
    const renderable = this.occupancyGridsByTopic.get(topic);
    if (renderable) {
      renderable.userData.settings = { ...renderable.userData.settings, ...settings };
      this._updateOccupancyGridRenderable(renderable, renderable.userData.occupancyGrid);
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

    for (const renderable of this.occupancyGridsByTopic.values()) {
      renderable.visible = renderable.userData.settings.visible;
      if (!renderable.visible) {
        this.renderer.layerErrors.clearTopic(renderable.userData.topic);
        continue;
      }

      const frameLocked = renderable.userData.settings.frameLocked;
      const srcTime = frameLocked ? currentTime : renderable.userData.srcTime;
      const frameId = renderable.userData.occupancyGrid.header.frame_id;
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

  _updateOccupancyGridRenderable(
    renderable: OccupancyGridRenderable,
    occupancyGrid: OccupancyGrid,
  ): void {
    renderable.userData.occupancyGrid = occupancyGrid;
    renderable.userData.pose = occupancyGrid.info.origin;
    renderable.userData.srcTime = toNanoSec(occupancyGrid.header.stamp);

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

  static Geometry(): THREE.PlaneGeometry {
    if (!OccupancyGrids.geometry) {
      OccupancyGrids.geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
      OccupancyGrids.geometry.translate(0.5, 0.5, 0);
      OccupancyGrids.geometry.computeBoundingSphere();
    }
    return OccupancyGrids.geometry;
  }
}

function invalidOccupancyGridError(
  renderer: Renderer,
  renderable: OccupancyGridRenderable,
  message: string,
): void {
  renderer.layerErrors.addToTopic(renderable.userData.topic, INVALID_OCCUPANCY_GRID, message);
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
    if (value === -1) {
      // Unknown (-1)
      rgba[offset + 0] = tempUnknownColor.r;
      rgba[offset + 1] = tempUnknownColor.g;
      rgba[offset + 2] = tempUnknownColor.b;
      rgba[offset + 3] = tempUnknownColor.a;
    } else if (value >= 0 && value <= 100) {
      // Valid [0-100]
      const t = value / 100;
      if (t === 1) {
        rgba[offset + 0] = 0;
        rgba[offset + 1] = 0;
        rgba[offset + 2] = 0;
        rgba[offset + 3] = 0;
      } else {
        rgba[offset + 0] = tempMinColor.r + (tempMaxColor.r - tempMinColor.r) * t;
        rgba[offset + 1] = tempMinColor.g + (tempMaxColor.g - tempMinColor.g) * t;
        rgba[offset + 2] = tempMinColor.b + (tempMaxColor.b - tempMinColor.b) * t;
        rgba[offset + 3] = tempMinColor.a + (tempMaxColor.a - tempMinColor.a) * t;
      }
    } else {
      // Invalid (< -1 or > 100)
      rgba[offset + 0] = tempInvalidColor.r;
      rgba[offset + 1] = tempInvalidColor.g;
      rgba[offset + 2] = tempInvalidColor.b;
      rgba[offset + 3] = tempInvalidColor.a;
    }
  }

  texture.needsUpdate = true;
}

function createMaterial(
  texture: THREE.DataTexture,
  topic: string,
  settings: LayerSettingsOccupancyGrid,
): THREE.MeshStandardMaterial | THREE.MeshBasicMaterial {
  const transparent = occupancyGridHasTransparency(settings);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
  });
  material.name = `${topic}:Material`;
  material.transparent = transparent;
  material.depthWrite = !material.transparent;
  return material;
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
  stringToRgba(tempMinColor, settings.minColor);
  stringToRgba(tempMaxColor, settings.maxColor);
  stringToRgba(tempUnknownColor, settings.unknownColor);
  stringToRgba(tempInvalidColor, settings.invalidColor);
  return (
    tempMinColor.a < 1 || tempMaxColor.a < 1 || tempInvalidColor.a < 1 || tempUnknownColor.a < 1
  );
}

function srgbToLinearUint8(color: ColorRGBA): void {
  color.r = Math.trunc(SRGBToLinear(color.r) * 255);
  color.g = Math.trunc(SRGBToLinear(color.g) * 255);
  color.b = Math.trunc(SRGBToLinear(color.b) * 255);
  color.a = Math.trunc(color.a * 255);
}
