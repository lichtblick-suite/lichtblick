// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// The STL parsing logic is adapted from the MIT licensed ts-three-stl-loader at
// <https://github.com/GarrettCannon/ts-three-stl-loader/blob/8db9d94fb609aa010555b70f99c37083c2ca0814/src/index.ts>

import { GlbModel } from "@foxglove/studio-base/panels/ThreeDimensionalViz/utils/GlbModel";
import type { GlTf } from "@foxglove/studio-base/panels/ThreeDimensionalViz/utils/gltf";

type Vector3 = [number, number, number];
type StlData = {
  position: Float32Array;
  normal: Float32Array;
  indices: Uint16Array;
  minPosition: Vector3;
  maxPosition: Vector3;
  minNormal: Vector3;
  maxNormal: Vector3;
};

const UNITS_REGEX = /UNITS=(mm|cm| m|ft|in)/;
const DEFAULT_COLOR = [36 / 255, 142 / 255, 255 / 255, 1];

const textDecoder = new TextDecoder();

export function parseStlToGlb(buffer: ArrayBuffer): GlbModel | undefined {
  const stlData = parse(buffer);
  if (!stlData) {
    return undefined;
  }

  const json: GlTf = {
    accessors: [
      {
        bufferView: 0,
        componentType: WebGLRenderingContext.FLOAT,
        count: stlData.position.length / 3,
        type: "VEC3",
        min: stlData.minPosition,
        max: stlData.maxPosition,
      },
      {
        bufferView: 1,
        componentType: WebGLRenderingContext.FLOAT,
        count: stlData.normal.length / 3,
        type: "VEC3",
        min: stlData.minNormal,
        max: stlData.maxNormal,
      },
      {
        bufferView: 2,
        componentType: WebGLRenderingContext.UNSIGNED_SHORT,
        count: stlData.indices.length,
        type: "SCALAR",
        min: [0],
        max: [stlData.position.length - 1],
      },
    ],
    asset: { generator: "Foxglove Studio STL parser", version: "2.0" },
    bufferViews: [
      { buffer: 0, byteLength: stlData.position.byteLength },
      { buffer: 1, byteLength: stlData.normal.byteLength },
      { buffer: 2, byteLength: stlData.indices.byteLength },
    ],
    buffers: [
      { byteLength: stlData.position.byteLength },
      { byteLength: stlData.normal.byteLength },
      { byteLength: stlData.indices.byteLength },
    ],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: DEFAULT_COLOR,
          metallicFactor: 0,
          roughnessFactor: 1,
        },
      },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    nodes: [{ mesh: 0, rotation: [-Math.SQRT1_2, 0, 0, Math.SQRT1_2] }], // Z-up to Y-up
    scene: 0,
    scenes: [{ nodes: [0] }],
  };

  return {
    json,
    accessors: [stlData.position, stlData.normal, stlData.indices],
    images: [],
  };
}

function parse(data: ArrayBuffer): StlData | undefined {
  return isBinary(data) ? parseBinary(data) : parseAscii(textDecoder.decode(data));
}

function isBinary(data: ArrayBuffer) {
  const reader = new DataView(data);
  const face_size = (32 / 8) * 3 + (32 / 8) * 3 * 3 + 16 / 8;
  const n_faces = reader.getUint32(80, true);
  const expect = 80 + 32 / 8 + n_faces * face_size;

  if (expect === reader.byteLength) {
    return true;
  }

  // An ASCII STL data must begin with 'solid ' as the first six bytes.
  // However, ASCII STLs lacking the SPACE after the 'd' are known to be
  // plentiful.  So, check the first 5 bytes for 'solid'.

  // US-ASCII ordinal values for 's', 'o', 'l', 'i', 'd'
  const solid = [115, 111, 108, 105, 100];

  for (let i = 0; i < 5; i++) {
    // If solid[i] does not match the i-th byte, then it is not an
    // ASCII STL; hence, it is binary and return true
    if (solid[i] !== reader.getUint8(i)) {
      return true;
    }
  }

  // First 5 bytes read "solid"; declare it to be an ASCII STL
  return false;
}

function parseBinary(data: ArrayBuffer): StlData | undefined {
  // A non-empty binary STL file has an 84 byte header and at least one 50 byte triangle
  if (data.byteLength < 134) {
    return undefined;
  }

  const header = textDecoder.decode(data.slice(0, 80));
  const scale = getScale(header);

  const reader = new DataView(data);
  const maxFaces = reader.getUint32(80, true);
  const faceCount = Math.min(Math.floor((data.byteLength - 84) / 50), maxFaces);
  const vertexCount = faceCount * 3;
  const floatCount = vertexCount * 3;

  const dataOffset = 84;
  const faceLength = 12 * 4 + 2;

  const stlData: StlData = {
    position: new Float32Array(floatCount),
    normal: new Float32Array(floatCount),
    indices: new Uint16Array(vertexCount),
    minPosition: [Infinity, Infinity, Infinity],
    maxPosition: [-Infinity, -Infinity, -Infinity],
    minNormal: [Infinity, Infinity, Infinity],
    maxNormal: [-Infinity, -Infinity, -Infinity],
  };

  for (let face = 0; face < faceCount; face++) {
    const start = dataOffset + face * faceLength;
    const normalX = reader.getFloat32(start, true);
    const normalY = reader.getFloat32(start + 4, true);
    const normalZ = reader.getFloat32(start + 8, true);

    stlData.minNormal[0] = Math.min(stlData.minNormal[0], normalX);
    stlData.minNormal[1] = Math.min(stlData.minNormal[1], normalY);
    stlData.minNormal[2] = Math.min(stlData.minNormal[2], normalZ);
    stlData.maxNormal[0] = Math.max(stlData.maxNormal[0], normalX);
    stlData.maxNormal[1] = Math.max(stlData.maxNormal[1], normalY);
    stlData.maxNormal[2] = Math.max(stlData.maxNormal[2], normalZ);

    for (let i = 1; i <= 3; i++) {
      const vertexStart = start + i * 12;
      const vertexX = reader.getFloat32(vertexStart, true) * scale;
      const vertexY = reader.getFloat32(vertexStart + 4, true) * scale;
      const vertexZ = reader.getFloat32(vertexStart + 8, true) * scale;

      stlData.minPosition[0] = Math.min(stlData.minPosition[0], vertexX);
      stlData.minPosition[1] = Math.min(stlData.minPosition[1], vertexY);
      stlData.minPosition[2] = Math.min(stlData.minPosition[2], vertexZ);
      stlData.maxPosition[0] = Math.max(stlData.maxPosition[0], vertexX);
      stlData.maxPosition[1] = Math.max(stlData.maxPosition[1], vertexY);
      stlData.maxPosition[2] = Math.max(stlData.maxPosition[2], vertexZ);

      const positionStart = face * 9 + (i - 1) * 3;
      stlData.position[positionStart] = vertexX;
      stlData.position[positionStart + 1] = vertexY;
      stlData.position[positionStart + 2] = vertexZ;

      stlData.normal[positionStart] = normalX;
      stlData.normal[positionStart + 1] = normalY;
      stlData.normal[positionStart + 2] = normalZ;

      const indexStart = face * 3 + i - 1;
      stlData.indices[indexStart] = indexStart;
      stlData.indices[indexStart + 1] = indexStart + 1;
      stlData.indices[indexStart + 2] = indexStart + 2;
    }
  }

  return stlData;
}

function parseAscii(data: string): StlData | undefined {
  const FACE_REGEX = /facet([\s\S]*?)endfacet/g;
  const NORMAL_REGEX =
    /normal[\s]+([-+]?[0-9]+\.?[0-9]*([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+/g;
  const VERTEX_REGEX =
    /vertex[\s]+([-+]?[0-9]+\.?[0-9]*([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+[\s]+([-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?)+/g;

  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const minPosition: Vector3 = [Infinity, Infinity, Infinity];
  const maxPosition: Vector3 = [-Infinity, -Infinity, -Infinity];
  const minNormal: Vector3 = [Infinity, Infinity, Infinity];
  const maxNormal: Vector3 = [-Infinity, -Infinity, -Infinity];

  const normal = { x: 0, y: 0, z: 0 };

  let i = 0;
  let result: ReturnType<typeof FACE_REGEX.exec>;
  while ((result = FACE_REGEX.exec(data))) {
    const text = result[0]!;

    while ((result = NORMAL_REGEX.exec(text))) {
      normal.x = parseFloat(result[1]!);
      normal.y = parseFloat(result[3]!);
      normal.z = parseFloat(result[5]!);
    }

    minNormal[0] = Math.min(minNormal[0], normal.x);
    minNormal[1] = Math.min(minNormal[1], normal.y);
    minNormal[2] = Math.min(minNormal[2], normal.z);
    maxNormal[0] = Math.max(maxNormal[0], normal.x);
    maxNormal[1] = Math.max(maxNormal[1], normal.y);
    maxNormal[2] = Math.max(maxNormal[2], normal.z);

    while ((result = VERTEX_REGEX.exec(text))) {
      const vertexX = parseFloat(result[1]!);
      const vertexY = parseFloat(result[3]!);
      const vertexZ = parseFloat(result[5]!);

      minPosition[0] = Math.min(minPosition[0], vertexX);
      minPosition[1] = Math.min(minPosition[1], vertexY);
      minPosition[2] = Math.min(minPosition[2], vertexZ);
      maxPosition[0] = Math.max(maxPosition[0], vertexX);
      maxPosition[1] = Math.max(maxPosition[1], vertexY);
      maxPosition[2] = Math.max(maxPosition[2], vertexZ);

      vertices.push(vertexX, vertexY, vertexZ);
      normals.push(normal.x, normal.y, normal.z);
      indices.push(i++, i++, i++);
    }
  }

  return {
    position: new Float32Array(vertices),
    normal: new Float32Array(normals),
    indices: new Uint16Array(indices),
    minPosition,
    maxPosition,
    minNormal,
    maxNormal,
  };
}

function getScale(header: string): number {
  const result = UNITS_REGEX.exec(header);
  const unit = result ? result[1]! : " m";
  switch (unit) {
    case "mm":
      return 1000;
    case "cm":
      return 100;
    case "ft":
      return 3.28084;
    case "in":
      return 39.3701;
    case " m":
    default:
      return 1;
  }
}
