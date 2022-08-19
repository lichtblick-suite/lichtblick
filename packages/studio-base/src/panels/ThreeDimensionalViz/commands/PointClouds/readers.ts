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

import log from "@foxglove/studio-base/panels/ThreeDimensionalViz/logger";

import { DATATYPE } from "./types";

export interface FieldReader {
  read(byteOffset: number): number;
}

export class Int8Reader implements FieldReader {
  private view: DataView;

  public constructor(data: Uint8Array, offset: number) {
    this.view = new DataView(data.buffer, data.byteOffset + offset, data.byteLength - offset);
  }

  public read(byteOffset: number): number {
    return this.view.getInt8(byteOffset);
  }
}

export class Uint8Reader implements FieldReader {
  private view: DataView;

  public constructor(data: Uint8Array, offset: number) {
    this.view = new DataView(data.buffer, data.byteOffset + offset, data.byteLength - offset);
  }

  public read(byteOffset: number): number {
    return this.view.getUint8(byteOffset);
  }
}

export class Int16Reader implements FieldReader {
  private view: DataView;

  public constructor(data: Uint8Array, offset: number) {
    this.view = new DataView(data.buffer, data.byteOffset + offset, data.byteLength - offset);
  }

  public read(byteOffset: number): number {
    return this.view.getInt16(byteOffset, true);
  }
}

export class Uint16Reader implements FieldReader {
  private view: DataView;

  public constructor(data: Uint8Array, offset: number) {
    this.view = new DataView(data.buffer, data.byteOffset + offset, data.byteLength - offset);
  }

  public read(byteOffset: number): number {
    return this.view.getUint16(byteOffset, true);
  }
}

export class Int32Reader implements FieldReader {
  private view: DataView;

  public constructor(data: Uint8Array, offset: number) {
    this.view = new DataView(data.buffer, data.byteOffset + offset, data.byteLength - offset);
  }

  public read(byteOffset: number): number {
    return this.view.getInt32(byteOffset, true);
  }
}

export class Uint32Reader implements FieldReader {
  private view: DataView;

  public constructor(data: Uint8Array, offset: number) {
    this.view = new DataView(data.buffer, data.byteOffset + offset, data.byteLength - offset);
  }

  public read(byteOffset: number): number {
    return this.view.getUint32(byteOffset, true);
  }
}

export class Float32Reader implements FieldReader {
  private view: DataView;

  public constructor(data: Uint8Array, offset: number) {
    this.view = new DataView(data.buffer, data.byteOffset + offset, data.byteLength - offset);
  }

  public read(byteOffset: number): number {
    return this.view.getFloat32(byteOffset, true);
  }
}

export class Float64Reader implements FieldReader {
  private view: DataView;

  public constructor(data: Uint8Array, offset: number) {
    this.view = new DataView(data.buffer, data.byteOffset + offset, data.byteLength - offset);
  }

  public read(byteOffset: number): number {
    return this.view.getFloat64(byteOffset, true);
  }
}

export function getReader(
  data: Uint8Array,
  datatype: number,
  offset: number,
): FieldReader | undefined {
  if (offset >= data.length) {
    throw new Error(`Point cloud data offset ${offset} starts past ${data.length} byte buffer`);
  }

  switch (datatype) {
    case DATATYPE.INT8:
      return new Int8Reader(data, offset);
    case DATATYPE.UINT8:
      return new Uint8Reader(data, offset);
    case DATATYPE.INT16:
      return new Int16Reader(data, offset);
    case DATATYPE.UINT16:
      return new Uint16Reader(data, offset);
    case DATATYPE.INT32:
      return new Int32Reader(data, offset);
    case DATATYPE.UINT32:
      return new Uint32Reader(data, offset);
    case DATATYPE.FLOAT32:
      return new Float32Reader(data, offset);
    case DATATYPE.FLOAT64:
      return new Float64Reader(data, offset);
    default:
      log.error("Unrecognized PointCloud2 field datatype", datatype);
      return undefined;
  }
}
