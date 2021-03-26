// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { BlockId } from "./VelodyneTypes";

export class RawBlock {
  view: DataView;
  blockId: BlockId;
  rotation: number; // [0-35999], divide by 100 to get degrees

  constructor(public data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.blockId = this.view.getUint16(0, true);
    this.rotation = this.view.getUint16(2, true);
  }

  isUpperBlock(): boolean {
    return this.blockId === BlockId.Block_32_To_63;
  }

  isValid(index: number): boolean {
    const offset = 4 + 3 * index;
    return this.data[offset] !== 0 || this.data[offset + 1] !== 0;
  }

  distance(index: number): number {
    return this.view.getUint16(4 + 3 * index, true);
  }

  intensity(index: number): number {
    return this.data[4 + 3 * index + 2] as number;
  }
}
