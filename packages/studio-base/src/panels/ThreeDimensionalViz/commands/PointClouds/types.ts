// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import type REGL from "regl";

import { PointCloudSettings } from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/PointCloudSettingsEditor";
import { PointCloud2 } from "@foxglove/studio-base/types/Messages";

export enum DATATYPE {
  INT8 = 1,
  UINT8 = 2,
  INT16 = 3,
  UINT16 = 4,
  INT32 = 5,
  UINT32 = 6,
  FLOAT32 = 7,
  FLOAT64 = 8,
}

export type PointCloudMarker = PointCloud2 & {
  settings?: PointCloudSettings;

  // When hitmapColors are provided, we send them
  // straight to GPU, ignoring computations based on
  // color modes. As the name implies, this is only happening
  // when rendering to the Hitmap
  hitmapColors?: number[];
};

// Vertex buffer that will be used for attributes in shaders
export type VertexBuffer = {
  buffer: Float32Array;
  offset: number; // number of float values from the start of each vertex
  stride: number; // number of float values in between vertices
};

export type MemoizedMarker = {
  marker: PointCloudMarker;
  settings?: PointCloudSettings;
  hitmapColors?: number[];
};

export type MemoizedVertexBuffer = {
  vertexBuffer: VertexBuffer;
  buffer: REGL.Buffer;
  offset: number;
  stride: number;
  divisor: number;
};
