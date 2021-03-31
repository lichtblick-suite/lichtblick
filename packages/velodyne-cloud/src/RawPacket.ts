// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RawBlock } from "./RawBlock";
import { FactoryId, Model, ReturnMode } from "./VelodyneTypes";

export class RawPacket {
  static RAW_SCAN_SIZE = 3;
  static SCANS_PER_BLOCK = 32;
  static BLOCK_DATA_SIZE = RawPacket.SCANS_PER_BLOCK * RawPacket.RAW_SCAN_SIZE;
  static BLOCK_SIZE = RawPacket.BLOCK_DATA_SIZE + 4;
  static BLOCKS_PER_PACKET = 12;
  static MAX_POINTS_PER_PACKET = RawPacket.BLOCKS_PER_PACKET * RawPacket.SCANS_PER_BLOCK;

  blocks: RawBlock[];
  gpsTimestamp: number; // microseconds since the top of the hour
  factoryField1: number; // raw representation of ReturnMode
  factoryField2: number; // raw representation of FactoryId
  returnMode?: ReturnMode;
  factoryId?: FactoryId;

  constructor(public data: Uint8Array) {
    if (data.length !== 1206) {
      throw new Error(`data has invalid length ${data.length}, expected 1206`);
    }

    this.blocks = [];
    for (let i = 0; i < RawPacket.BLOCKS_PER_PACKET; i++) {
      const blockSize = RawPacket.BLOCK_SIZE;
      const blockData = new Uint8Array(data.buffer, data.byteOffset + blockSize * i, blockSize);
      this.blocks.push(new RawBlock(blockData));
    }

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

    this.gpsTimestamp = view.getUint32(1200, true);
    this.factoryField1 = data[1204] as number;
    this.factoryField2 = data[1205] as number;
    this.returnMode = this.factoryField1 in ReturnMode ? this.factoryField1 : undefined;
    this.factoryId = this.factoryField2 in FactoryId ? this.factoryField2 : undefined;
  }

  inferModel(): Model | undefined {
    return RawPacket.InferModel(this.data);
  }

  static InferModel(packet: Uint8Array): Model | undefined {
    const factoryId = packet[1205];

    switch (factoryId) {
      case FactoryId.HDL32E:
        return Model.HDL32E;
      case FactoryId.VLP16:
        return Model.VLP16;
      case FactoryId.VLP32AB:
        return undefined;
      case FactoryId.VLP16HiRes:
        return Model.VLP16HiRes;
      case FactoryId.VLP32C:
        return Model.VLP32C;
      case FactoryId.Velarray:
        return undefined;
      case FactoryId.HDL64:
        // Is it possible to distinguish HDL64E / HDL64E_S21 / HDL64E_S3?
        return Model.HDL64E;
      case FactoryId.VLS128Old:
      case FactoryId.VLS128:
        return Model.VLS128;
      default:
        return undefined;
    }
  }
}
