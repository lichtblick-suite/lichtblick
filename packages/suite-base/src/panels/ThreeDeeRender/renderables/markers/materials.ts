// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { LineMaterialWithAlphaVertex } from "../../LineMaterialWithAlphaVertex";
import { ColorRGBA, Marker, MarkerType } from "../../ros";

export type LineOptions = {
  resolution: THREE.Vector2;
  worldUnits?: boolean;
};

export function markerHasTransparency(marker: Marker): boolean {
  switch (marker.type) {
    case MarkerType.ARROW:
    case MarkerType.CUBE:
    case MarkerType.SPHERE:
    case MarkerType.CYLINDER:
    case MarkerType.TEXT_VIEW_FACING:
    case MarkerType.MESH_RESOURCE:
      return marker.color.a < 1.0;
    case MarkerType.LINE_STRIP:
    case MarkerType.LINE_LIST:
    case MarkerType.CUBE_LIST:
    case MarkerType.SPHERE_LIST:
    case MarkerType.POINTS:
    case MarkerType.TRIANGLE_LIST:
    default:
      for (const color of marker.colors) {
        if (color.a < 1.0) {
          return true;
        }
      }
      return marker.colors.length >= marker.points.length ? false : marker.color.a < 1.0;
  }
}

export function makeStandardMaterial(color: ColorRGBA): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color.r, color.g, color.b).convertSRGBToLinear(),
    metalness: 0,
    roughness: 1,
    dithering: true,
    opacity: color.a,
    transparent: color.a < 1,
    depthWrite: color.a === 1,
  });
}

export function makeStandardVertexColorMaterial(marker: Marker): THREE.MeshStandardMaterial {
  const transparent = markerHasTransparency(marker);
  return new THREE.MeshStandardMaterial({
    metalness: 0,
    roughness: 1,
    dithering: true,
    vertexColors: true,
    side: THREE.DoubleSide,
    opacity: 1,
    transparent,
    depthWrite: !transparent,
  });
}

export function makeStandardInstancedMaterial(marker: Marker): THREE.MeshStandardMaterial {
  const transparent = markerHasTransparency(marker);
  return new THREE.MeshStandardMaterial({
    metalness: 0,
    roughness: 1,
    dithering: true,
    opacity: 1,
    transparent,
    depthWrite: !transparent,
  });
}

export function makeLinePrepassMaterial(
  marker: Marker,
  options: LineOptions,
): LineMaterialWithAlphaVertex {
  const lineWidth = marker.scale.x;
  const transparent = markerHasTransparency(marker);
  const material = new LineMaterialWithAlphaVertex({
    worldUnits: options.worldUnits ?? true,
    colorWrite: false,
    transparent,
    depthWrite: !transparent,
    linewidth: lineWidth,
    resolution: options.resolution.clone(),

    stencilWrite: true,
    stencilRef: 1,
    stencilZPass: THREE.ReplaceStencilOp,
  });
  material.lineWidth = lineWidth;
  return material;
}

export function makeLineMaterial(
  marker: Marker,
  options: LineOptions,
): LineMaterialWithAlphaVertex {
  const lineWidth = marker.scale.x;
  const transparent = markerHasTransparency(marker);
  const material = new LineMaterialWithAlphaVertex({
    worldUnits: options.worldUnits ?? true,
    vertexColors: true,
    linewidth: lineWidth,
    transparent,
    depthWrite: !transparent,
    resolution: options.resolution.clone(),

    stencilWrite: true,
    stencilRef: 0,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.ReplaceStencilOp,
    stencilZPass: THREE.ReplaceStencilOp,
  });
  material.lineWidth = lineWidth;
  return material;
}

export function makeLinePickingMaterial(
  lineWidth: number,
  options: LineOptions,
): THREE.ShaderMaterial {
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
      resolution: { value: options.resolution.clone() },
      dashOffset: { value: 0 },
      dashScale: { value: 1 },
      dashSize: { value: 1 },
      gapSize: { value: 1 },
    },
    defines: options.worldUnits ?? true ? { WORLD_UNITS: "" } : {},
  });
}

export function makePointsMaterial(marker: Marker): THREE.PointsMaterial {
  const transparent = markerHasTransparency(marker);
  return new THREE.PointsMaterial({
    vertexColors: true,
    size: marker.scale.x,
    sizeAttenuation: true,
    transparent,
    depthWrite: !transparent,
  });
}
