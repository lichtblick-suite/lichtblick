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

import { DATATYPE } from "./types";
import log from "@foxglove-studio/app/panels/ThreeDimensionalViz/logger";

export interface FieldReader {
  read(data: number[] | Uint8Array, index: number): number;
}

// Shared between all readers. The JS main thread doesn't get preempted. Instantiating the buffer is
// weirdly expensive. The buffer needs to be big enough for the largest reader type.
const buffer = new ArrayBuffer(4);
const view = new DataView(buffer);

export class Float32Reader implements FieldReader {
  offset: number;
  constructor(offset: number) {
    this.offset = offset;
  }

  read(data: number[] | Uint8Array, index: number): number {
    view.setUint8(0, data[index + this.offset]);
    view.setUint8(1, data[index + this.offset + 1]);
    view.setUint8(2, data[index + this.offset + 2]);
    view.setUint8(3, data[index + this.offset + 3]);
    return view.getFloat32(0, true);
  }
}

export class Int32Reader implements FieldReader {
  offset: number;
  constructor(offset: number) {
    this.offset = offset;
  }

  read(data: number[] | Uint8Array, index: number): number {
    view.setUint8(0, data[index + this.offset]);
    view.setUint8(1, data[index + this.offset + 1]);
    view.setUint8(2, data[index + this.offset + 2]);
    view.setUint8(3, data[index + this.offset + 3]);
    return view.getInt32(0, true);
  }
}

export class Uint16Reader implements FieldReader {
  offset: number;
  constructor(offset: number) {
    this.offset = offset;
  }

  read(data: number[] | Uint8Array, index: number): number {
    view.setUint8(0, data[index + this.offset]);
    view.setUint8(1, data[index + this.offset + 1]);
    return view.getUint16(0, true);
  }
}
export class Int16Reader implements FieldReader {
  offset: number;
  constructor(offset: number) {
    this.offset = offset;
  }

  read(data: number[] | Uint8Array, index: number): number {
    view.setUint8(0, data[index + this.offset]);
    view.setUint8(1, data[index + this.offset + 1]);
    return view.getInt16(0, true);
  }
}

export class Uint8Reader implements FieldReader {
  offset: number;
  constructor(offset: number) {
    this.offset = offset;
  }

  read(data: number[] | Uint8Array, index: number): number {
    return data[index + this.offset];
  }
}

export function getReader(datatype: number, offset: number) {
  switch (datatype) {
    case DATATYPE.float32:
      return new Float32Reader(offset);
    case DATATYPE.uint8:
      return new Uint8Reader(offset);
    case DATATYPE.uint16:
      return new Uint16Reader(offset);
    case DATATYPE.int16:
      return new Int16Reader(offset);
    case DATATYPE.int32:
      return new Int32Reader(offset);
    default:
      log.error("Unsupported datatype", datatype);
  }
  return undefined;
}
