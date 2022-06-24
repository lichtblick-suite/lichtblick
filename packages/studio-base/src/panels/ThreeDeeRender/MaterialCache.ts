// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable @foxglove/no-boolean-parameters */

import * as THREE from "three";

import Logger from "@foxglove/log";

import { LineMaterial } from "./LineMaterial";
import { rgbaToHexString } from "./color";
import { ColorRGBA } from "./ros";

type DisposeMaterial = (material: THREE.Material) => void;

type MaterialCacheEntry = {
  material: THREE.Material;
  refCount: number;
  disposer: DisposeMaterial;
};

const log = Logger.getLogger(__filename);

// Fragment shader chunk to convert sRGB to linear RGB. This is used by some
// PointCloud materials to avoid expensive per-point colorspace conversion on
// the CPU. Source: <https://github.com/mrdoob/three.js/blob/13b67d96/src/renderers/shaders/ShaderChunk/encodings_pars_fragment.glsl.js#L16-L18>
const FS_SRGB_TO_LINEAR = /* glsl */ `
vec3 sRGBToLinear(in vec3 value) {
	return vec3(mix(
    pow(value.rgb * 0.9478672986 + vec3(0.0521327014), vec3(2.4)),
    value.rgb * 0.0773993808,
    vec3(lessThanEqual(value.rgb, vec3(0.04045)))
  ));
}

vec4 sRGBToLinear(in vec4 value) {
  return vec4(sRGBToLinear(value.rgb), value.a);
}
`;

// Fragment shader chunk to convert sRGB to linear RGB
const FS_POINTCLOUD_SRGB_TO_LINEAR = /* glsl */ `
outgoingLight = sRGBToLinear(outgoingLight);
`;

// Fragment shader chunk to render a GL_POINT as a circle
const FS_POINTCLOUD_CIRCLE = /* glsl */ `
vec2 cxy = 2.0 * gl_PointCoord - 1.0;
if (dot(cxy, cxy) > 1.0) { discard; }
`;

export class MaterialCache {
  materials = new Map<string, MaterialCacheEntry>();
  outlineMaterial = new THREE.LineBasicMaterial({ dithering: true });

  acquire<TMaterial extends THREE.Material>(
    id: string,
    create: () => TMaterial,
    dispose: (material: TMaterial) => void,
  ): TMaterial {
    let entry = this.materials.get(id);
    if (!entry) {
      log.debug(`Creating material ${id}`);
      entry = { material: create(), refCount: 0, disposer: dispose as DisposeMaterial };
      this.materials.set(id, entry);
    }
    ++entry.refCount;
    return entry.material as TMaterial;
  }

  release(id: string): number {
    const entry = this.materials.get(id);
    if (!entry) {
      return 0;
    }
    entry.refCount--;
    if (entry.refCount === 0) {
      log.debug(`Disposing material ${id}`);
      entry.disposer(entry.material);
      this.materials.delete(id);
    }
    return entry.refCount;
  }

  update(resolution: THREE.Vector2): void {
    for (const entry of this.materials.values()) {
      // Update render resolution uniforms
      if (entry.material instanceof LineMaterial) {
        entry.material.resolution = resolution;
      } else if (
        entry.material instanceof THREE.ShaderMaterial &&
        entry.material.uniforms.resolution != undefined
      ) {
        entry.material.uniforms.resolution.value = resolution;
      }
    }
  }
}

export const BasicColor = {
  id: (color: ColorRGBA): string => "BasicColor-" + rgbaToHexString(color),

  create: (color: ColorRGBA): THREE.MeshBasicMaterial => {
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color.r, color.g, color.b).convertSRGBToLinear(),
      dithering: true,
    });
    material.name = BasicColor.id(color);
    material.opacity = color.a;
    material.transparent = color.a < 1;
    material.depthWrite = !material.transparent;
    return material;
  },

  dispose: (material: THREE.MeshBasicMaterial): void => {
    material.map?.dispose();
    material.lightMap?.dispose();
    material.aoMap?.dispose();
    material.specularMap?.dispose();
    material.alphaMap?.dispose();
    material.envMap?.dispose();
    material.dispose();
  },
};

export const StandardColor = {
  id: (color: ColorRGBA): string => "StandardColor-" + rgbaToHexString(color),

  create: (color: ColorRGBA): THREE.MeshStandardMaterial => {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color.r, color.g, color.b).convertSRGBToLinear(),
      metalness: 0,
      roughness: 1,
      dithering: true,
    });
    material.name = StandardColor.id(color);
    material.opacity = color.a;
    material.transparent = color.a < 1;
    material.depthWrite = !material.transparent;
    return material;
  },

  dispose: disposeStandardMaterial,
};

export const StandardVertexColor = {
  id: (transparent: boolean): string => "StandardVertexColor" + (transparent ? "-t" : ""),

  create: (transparent: boolean): THREE.MeshStandardMaterial => {
    const material = new THREE.MeshStandardMaterial({
      metalness: 0,
      roughness: 1,
      dithering: true,
      vertexColors: true,
      side: THREE.DoubleSide,
    });
    material.name = StandardVertexColor.id(transparent);
    material.opacity = 1;
    material.transparent = transparent;
    material.depthWrite = !material.transparent;
    return material;
  },

  dispose: disposeStandardMaterial,
};

export const StandardInstancedColor = {
  id: (transparent: boolean): string => "StandardInstancedColor" + (transparent ? "-t" : ""),

  create: (transparent: boolean): THREE.MeshStandardMaterial => {
    const material = new THREE.MeshStandardMaterial({
      metalness: 0,
      roughness: 1,
      dithering: true,
    });
    material.name = StandardInstancedColor.id(transparent);
    material.opacity = 1;
    material.transparent = transparent;
    material.depthWrite = !material.transparent;
    return material;
  },

  dispose: disposeStandardMaterial,
};

type Scale2D = { x: number; y: number };

export const PointsVertexColor = {
  id: (scale: Scale2D, transparent: boolean): string =>
    `PointsVertexColor-${scale.x}x${scale.y}${transparent ? "-t" : ""}`,

  create: (scale: Scale2D, transparent: boolean): THREE.PointsMaterial => {
    const material = new THREE.PointsMaterial({
      vertexColors: true,
      size: scale.x, // TODO: Support scale.y
      sizeAttenuation: true,
    });
    material.name = PointsVertexColor.id(scale, transparent);
    material.transparent = transparent;
    material.depthWrite = !transparent;
    return material;
  },

  dispose: (material: THREE.PointsMaterial): void => {
    material.map?.dispose();
    material.alphaMap?.dispose();
    material.dispose();
  },
};

export const PointCloudColor = {
  id: (
    shape: "circle" | "square",
    encoding: "srgb" | "linear",
    scale: number,
    transparent: boolean,
  ): string => `PointCloudColor-${shape}-${encoding}-${scale}${transparent ? "-t" : ""}`,

  create: (
    shape: "circle" | "square",
    encoding: "srgb" | "linear",
    scale: number,
    transparent: boolean,
  ): THREE.PointsMaterial => {
    const material = new THREE.PointsMaterial({
      vertexColors: true,
      size: scale,
      sizeAttenuation: false,
    });
    material.name = PointCloudColor.id(shape, encoding, scale, transparent);
    material.transparent = transparent;
    // The sorting issues caused by writing semi-transparent pixels to the depth buffer are less
    // distracting for point clouds than the self-sorting artifacts when depth writing is disabled
    material.depthWrite = true;
    // Tell three.js to recompile the shader when `shape` or `encoding` change
    material.customProgramCacheKey = () => `${shape}-${encoding}`;
    material.onBeforeCompile = (shader) => {
      const SEARCH = "#include <output_fragment>";
      if (shape === "circle") {
        // Patch the fragment shader to render points as circles
        shader.fragmentShader =
          FS_SRGB_TO_LINEAR + shader.fragmentShader.replace(SEARCH, FS_POINTCLOUD_CIRCLE + SEARCH);
      }
      if (encoding === "srgb") {
        // Patch the fragment shader to add sRGB->linear color conversion
        shader.fragmentShader = shader.fragmentShader.replace(
          SEARCH,
          FS_POINTCLOUD_SRGB_TO_LINEAR + SEARCH,
        );
      }
    };
    return material;
  },

  dispose: (material: THREE.PointsMaterial): void => {
    material.map?.dispose();
    material.alphaMap?.dispose();
    material.dispose();
  },
};

export const LineVertexColorPrepass = {
  id: (lineWidth: number, transparent: boolean): string =>
    `LineVertexColorPrepass-${lineWidth.toFixed(4)}${transparent ? "-t" : ""}`,

  create: (lineWidth: number, transparent: boolean): LineMaterial => {
    const material = new LineMaterial({
      worldUnits: true,
      colorWrite: false,

      stencilWrite: true,
      stencilRef: 1,
      stencilZPass: THREE.ReplaceStencilOp,
    });
    material.name = LineVertexColorPrepass.id(lineWidth, transparent);
    material.lineWidth = lineWidth;
    material.transparent = transparent;
    material.depthWrite = !transparent;
    return material;
  },

  dispose: (material: LineMaterial): void => {
    material.dispose();
  },
};

export const LineVertexColor = {
  id: (lineWidth: number, transparent: boolean): string =>
    `LineVertexColor-${lineWidth.toFixed(4)}${transparent ? "-t" : ""}`,

  create: (lineWidth: number, transparent: boolean): LineMaterial => {
    const material = new LineMaterial({
      worldUnits: true,
      vertexColors: true,

      stencilWrite: true,
      stencilRef: 0,
      stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.ReplaceStencilOp,
      stencilZPass: THREE.ReplaceStencilOp,
    });
    material.name = LineVertexColor.id(lineWidth, transparent);
    material.lineWidth = lineWidth;
    material.transparent = transparent;
    material.depthWrite = !transparent;
    return material;
  },

  dispose: (material: LineMaterial): void => {
    material.dispose();
  },
};

export const LineVertexColorPicking = {
  id: (lineWidth: number, worldUnits: boolean): string =>
    `LineVertexColorPicking-${lineWidth.toFixed(4)}${worldUnits ? "-w" : ""}`,

  create: (lineWidth: number, worldUnits: boolean): THREE.ShaderMaterial => {
    return new THREE.ShaderMaterial({
      vertexShader: THREE.ShaderLib["foxglove.line"]!.vertexShader,
      fragmentShader: /* glsl */ `
        uniform vec4 objectId;
        void main() {
          gl_FragColor = objectId;
        }
      `,
      clipping: true,
      uniforms: {
        objectId: { value: [NaN, NaN, NaN, NaN] },
        linewidth: { value: lineWidth },
        resolution: { value: new THREE.Vector2(1, 1) },
        dashOffset: { value: 0 },
        dashScale: { value: 1 },
        dashSize: { value: 1 },
        gapSize: { value: 1 },
      },
      defines: worldUnits ? { WORLD_UNITS: "" } : {},
    });
  },

  dispose: (material: THREE.ShaderMaterial): void => {
    material.dispose();
  },
};

function disposeStandardMaterial(material: THREE.MeshStandardMaterial): void {
  material.map?.dispose();
  material.lightMap?.dispose();
  material.aoMap?.dispose();
  material.emissiveMap?.dispose();
  material.bumpMap?.dispose();
  material.normalMap?.dispose();
  material.displacementMap?.dispose();
  material.roughnessMap?.dispose();
  material.metalnessMap?.dispose();
  material.alphaMap?.dispose();
  material.envMap?.dispose();
  material.dispose();
}
