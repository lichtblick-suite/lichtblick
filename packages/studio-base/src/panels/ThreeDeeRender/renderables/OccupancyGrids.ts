// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { Renderer } from "../Renderer";
import { SRGBToLinear } from "../color";
import { Pose, rosTimeToNanoSec, ColorRGBA, OccupancyGrid } from "../ros";
import { updatePose } from "../updatePose";
import { missingTransformMessage, MISSING_TRANSFORM } from "./transforms";

// TODO(jhurliman): Upload the OccupancyGrid data directly as a R8I texture and
// use a custom ShaderMaterial with an isampler2D uniform to reimplement the
// updateTexture() logic in a shader

export type OccupancyGridSettings = {
  minColor: ColorRGBA;
  maxColor: ColorRGBA;
  unknownColor: ColorRGBA;
  invalidColor: ColorRGBA;
  frameLocked: boolean;
};

// ts-prune-ignore-next
export type StoredOccupancyGridSettings = Partial<OccupancyGridSettings>;

const INVALID_OCCUPANCY_GRID = "INVALID_OCCUPANCY_GRID";

const DEFAULT_MIN_COLOR = { r: 1, g: 1, b: 1, a: 0.5 }; // white
const DEFAULT_MAX_COLOR = { r: 0, g: 0, b: 0, a: 0.5 }; // black
const DEFAULT_UNKNOWN_COLOR = { r: 0.5, g: 0.5, b: 0.5, a: 0.5 }; // gray
const DEFAULT_INVALID_COLOR = { r: 1, g: 0, b: 1, a: 1 }; // magenta

type OccupancyGridRenderable = THREE.Object3D & {
  userData: {
    topic: string;
    settings: OccupancyGridSettings;
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
      renderable = new THREE.Object3D() as OccupancyGridRenderable;
      renderable.name = topic;
      renderable.userData.topic = topic;

      // TODO: How do we fetch the stored settings for this topic?
      renderable.userData.settings = {
        minColor: DEFAULT_MIN_COLOR,
        maxColor: DEFAULT_MAX_COLOR,
        unknownColor: DEFAULT_UNKNOWN_COLOR,
        invalidColor: DEFAULT_INVALID_COLOR,
        frameLocked: true,
      };

      renderable.userData.occupancyGrid = occupancyGrid;
      renderable.userData.pose = occupancyGrid.info.origin;
      renderable.userData.srcTime = rosTimeToNanoSec(occupancyGrid.header.stamp);

      const texture = createTexture(occupancyGrid);
      const material = createMaterial(texture, renderable);
      const mesh = new THREE.Mesh(OccupancyGrids.Geometry(), material);
      mesh.userData.pickingMaterial = createPickingMaterial(texture);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      renderable.userData.texture = texture;
      renderable.userData.material = material;
      renderable.userData.mesh = mesh;
      renderable.add(renderable.userData.mesh);

      this.add(renderable);
      this.occupancyGridsByTopic.set(topic, renderable);
    }

    this._updateOccupancyGridRenderable(renderable, occupancyGrid);
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
      }
    }
  }

  _updateOccupancyGridRenderable(
    renderable: OccupancyGridRenderable,
    occupancyGrid: OccupancyGrid,
  ): void {
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
  renderable.userData.positionAttribute.resize(0);
  renderable.userData.colorAttribute.resize(0);
}

function createTexture(occupancyGrid: OccupancyGrid): THREE.DataTexture {
  const width = occupancyGrid.info.width;
  const height = occupancyGrid.info.height;
  const size = width * height;
  const rgba = new Uint8ClampedArray(size * 4);
  return new THREE.DataTexture(
    rgba,
    width,
    height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
    THREE.UVMapping,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.NearestFilter,
    THREE.NearestFilter,
    1,
    THREE.LinearEncoding,
  );
}

const tempUnknownColor = { r: 0, g: 0, b: 0, a: 0 };
const tempInvalidColor = { r: 0, g: 0, b: 0, a: 0 };
const tempMinColor = { r: 0, g: 0, b: 0, a: 0 };
const tempMaxColor = { r: 0, g: 0, b: 0, a: 0 };

function updateTexture(
  texture: THREE.DataTexture,
  occupancyGrid: OccupancyGrid,
  settings: OccupancyGridSettings,
): void {
  const size = occupancyGrid.info.width * occupancyGrid.info.height;
  const rgba = texture.image.data;

  tempUnknownColor.r = SRGBToLinear(settings.unknownColor.r) * 255;
  tempUnknownColor.g = SRGBToLinear(settings.unknownColor.g) * 255;
  tempUnknownColor.b = SRGBToLinear(settings.unknownColor.b) * 255;
  tempUnknownColor.a = settings.unknownColor.a * 255;

  tempInvalidColor.r = SRGBToLinear(settings.invalidColor.r) * 255;
  tempInvalidColor.g = SRGBToLinear(settings.invalidColor.g) * 255;
  tempInvalidColor.b = SRGBToLinear(settings.invalidColor.b) * 255;
  tempInvalidColor.a = settings.invalidColor.a * 255;

  tempMinColor.r = SRGBToLinear(settings.minColor.r) * 255;
  tempMinColor.g = SRGBToLinear(settings.minColor.g) * 255;
  tempMinColor.b = SRGBToLinear(settings.minColor.b) * 255;
  tempMinColor.a = settings.minColor.a * 255;

  tempMaxColor.r = SRGBToLinear(settings.maxColor.r) * 255;
  tempMaxColor.g = SRGBToLinear(settings.maxColor.g) * 255;
  tempMaxColor.b = SRGBToLinear(settings.maxColor.b) * 255;
  tempMaxColor.a = settings.maxColor.a * 255;

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
  renderable: OccupancyGridRenderable,
): THREE.MeshStandardMaterial | THREE.MeshBasicMaterial {
  const transparent = occupancyGridHasTransparency(renderable.userData.settings);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
  });
  material.name = `${renderable.userData.topic}:Material`;
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

function occupancyGridHasTransparency(settings: OccupancyGridSettings): boolean {
  return (
    settings.minColor.a < 1 ||
    settings.maxColor.a < 1 ||
    settings.invalidColor.a < 1 ||
    settings.unknownColor.a < 1
  );
}
