// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RawBlock } from "./RawBlock";
import { RawPacket } from "./RawPacket";
import { BlockId, FactoryId, ReturnMode } from "./VelodyneTypes";
import { HDL32E_PACKET1 } from "./fixtures/packets";

describe("RawPacket", () => {
  it("can decode a packet from an HDL-32E", () => {
    expect(() => new RawPacket(new Uint8Array())).toThrow();
    expect(() => new RawPacket(new Uint8Array(1205))).toThrow();
    expect(() => new RawPacket(new Uint8Array(1207))).toThrow();
    expect(() => new RawPacket(new Uint8Array(1206))).not.toThrow();

    const raw = new RawPacket(HDL32E_PACKET1);
    expect(raw.blocks).toHaveLength(12);
    expect(raw.data).toHaveLength(1206);
    expect(raw.factoryField1).toEqual(ReturnMode.Strongest);
    expect(raw.factoryField2).toEqual(FactoryId.HDL32E);
    expect(raw.gpsTimestamp).toEqual(757034951);
    expect(raw.returnMode).toEqual(ReturnMode.Strongest);
    expect(raw.factoryId).toEqual(FactoryId.HDL32E);
    expect(raw.blocks).toHaveLength(12);

    const block0 = raw.blocks[0] as RawBlock;
    expect(block0.data).toHaveLength(100);
    expect(block0.blockId).toEqual(BlockId.Block_0_To_31);
    expect(block0.rotation).toEqual(22288);
    expect(block0.isUpperBlock()).toEqual(false);
    expect(block0.distance(0)).toEqual(1230);
    expect(block0.intensity(0)).toEqual(9);
    expect(block0.distance(1)).toEqual(2537);
    expect(block0.intensity(1)).toEqual(4);

    for (const block of raw.blocks) {
      expect(block.data).toHaveLength(100);
      expect(block.blockId).toEqual(BlockId.Block_0_To_31);
      expect(block.isUpperBlock()).toEqual(false);
    }
  });
});
