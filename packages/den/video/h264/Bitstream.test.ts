// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Bitstream } from "./Bitstream";

describe("Bitstream", () => {
  it("Reads bits correctly", () => {
    // Let's use a buffer with two bytes: 0b10101010 (0xAA) and 0b11001100 (0xCC)
    const bitstream = new Bitstream(new Uint8Array([0xaa, 0xcc]));

    // u_1 should return the first bit of the first byte (1)
    expect(bitstream.u_1()).toEqual(1);

    // u_2 should return the next two bits of the first byte (01 = 1)
    expect(bitstream.u_2()).toEqual(1);

    // u_3 should return the next three bits of the first byte (010 = 2)
    expect(bitstream.u_3()).toEqual(2);

    // u_8 should return the remaining two bits of the first byte and the first
    // six bits of the second byte (10110011 = 0xB3)
    expect(bitstream.u_8()).toEqual(0xb3);
  });

  it("Handles emulation prevention bytes correctly", () => {
    // Let's use a buffer with the bytes 0x00, 0x00, 0x03, 0xFF, 0x00
    const bitstream = new Bitstream(new Uint8Array([0x00, 0x00, 0x03, 0xff, 0x00]));

    // u_8 should return the first byte (0x00)
    expect(bitstream.u_8()).toEqual(0x00);

    // u_8 should return the second byte (0x00)
    expect(bitstream.u_8()).toEqual(0x00);

    // The second u_8 should skip the emulation prevention byte (0x03) and
    // return the fourth byte (0xFF)
    expect(bitstream.u_8()).toEqual(0xff);

    bitstream.reset();

    // u(16) should return the first two bytes (0x0000)
    expect(bitstream.u(16)).toEqual(0);

    // u_1 should skip the emulation prevention byte (0x03) and return the first
    // bit of the fourth byte (1)
    expect(bitstream.u_1()).toEqual(1);

    bitstream.reset();

    // u(15) should return the first 15 bits (0x0000), leaving the pointer at an
    // unaligned position
    // just before the emulation prevention byte
    expect(bitstream.u(15)).toEqual(0);

    // u_8 should return 0b01111111 (0x7F)
    expect(bitstream.u_8()).toEqual(0x7f);

    bitstream.reset();

    // u(17) should return the first 16 bits, skip over the emulation prevention
    // byte (0x03), then the first bit of the fourth byte (1)
    expect(bitstream.u(17)).toEqual(1);
  });

  it("Reads example NAL data correctly", () => {
    const NALU = [
      0x25, 0x00, 0x1f, 0xe2, 0x22, 0x00, 0x00, 0x03, 0x02, 0x00, 0x00, 0x80, 0xab, 0xff,
    ];
    const bitstream = new Bitstream(new Uint8Array(NALU));

    // u_8 should return the first byte (0x25)
    expect(bitstream.u_8()).toEqual(0x25);

    // Reading two more bytes should give 0x00 and 0x1F
    expect(bitstream.u_8()).toEqual(0x00);
    expect(bitstream.u_8()).toEqual(0x1f);

    // Reading a 16-bit value should return 0xE222
    expect(bitstream.u(16)).toEqual(0xe222);

    // The next two bytes should be 0x00 and 0x00
    expect(bitstream.u(16)).toEqual(0);

    // The next byte should be 0x02, skipping over the emulation prevention byte
    // (0x03)
    expect(bitstream.u_8()).toEqual(0x02);

    // Reading a 32-bit value should return 0x000080AB
    expect(bitstream.u(32)).toEqual(0x000080ab);

    // The final byte should be 0xFF
    expect(bitstream.u_8()).toEqual(0xff);
  });

  it("Reads unsigned exponential Golomb-coded numbers correctly", () => {
    // 00100000 01011110 01010001 10100000
    // [3, 22, 0, 4, 12]
    const NALU = [0x20, 0x5e, 0x51, 0xa0];
    const bitstream = new Bitstream(new Uint8Array(NALU));

    expect(bitstream.ue_v()).toEqual(3);
    expect(bitstream.ue_v()).toEqual(22);
    expect(bitstream.ue_v()).toEqual(0);
    expect(bitstream.ue_v()).toEqual(4);
    expect(bitstream.ue_v()).toEqual(12);
  });

  it("Reads signed exponential Golomb-coded numbers correctly", () => {
    // 00100000 01011110 01010001 10100000
    // [2, -11, 0, -2, -6]
    const NALU = [0x20, 0x5e, 0x51, 0xa0];
    const bitstream = new Bitstream(new Uint8Array(NALU));

    expect(bitstream.se_v()).toEqual(2);
    expect(bitstream.se_v()).toEqual(-11);
    expect(bitstream.se_v()).toEqual(0);
    expect(bitstream.se_v()).toEqual(-2);
    expect(bitstream.se_v()).toEqual(-6);
  });
});
