// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { H264 } from "./H264";

describe("H264", () => {
  it("FindNextStartCode", () => {
    const NALU1 = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x02, 0x03]);

    expect(H264.FindNextStartCode(NALU1, 0)).toBe(0);
    expect(H264.FindNextStartCode(NALU1, 1)).toBe(1);
    expect(H264.FindNextStartCode(NALU1, 2)).toBe(6);
    expect(H264.FindNextStartCode(NALU1, 3)).toBe(6);
    expect(H264.FindNextStartCode(NALU1, 4)).toBe(6);
    expect(H264.FindNextStartCode(NALU1, 5)).toBe(6);
    expect(H264.FindNextStartCode(NALU1, 6)).toBe(6);
    expect(H264.FindNextStartCode(NALU1, 7)).toBe(6);

    const NALU2 = new Uint8Array([
      0x00, 0x01, 0x03, 0x0a, 0x00, 0x00, 0x01, 0x0b, 0x0c, 0x00, 0x00, 0x00, 0x01, 0x0d,
    ]);
    expect(H264.FindNextStartCode(NALU2, 0)).toBe(4);
    expect(H264.FindNextStartCode(NALU2, 1)).toBe(4);
    expect(H264.FindNextStartCode(NALU2, 2)).toBe(4);
    expect(H264.FindNextStartCode(NALU2, 3)).toBe(4);
    expect(H264.FindNextStartCode(NALU2, 4)).toBe(4);
    expect(H264.FindNextStartCode(NALU2, 5)).toBe(9);
    expect(H264.FindNextStartCode(NALU2, 6)).toBe(9);
    expect(H264.FindNextStartCode(NALU2, 7)).toBe(9);
    expect(H264.FindNextStartCode(NALU2, 8)).toBe(9);
    expect(H264.FindNextStartCode(NALU2, 9)).toBe(9);
    expect(H264.FindNextStartCode(NALU2, 10)).toBe(10);
    expect(H264.FindNextStartCode(NALU2, 11)).toBe(14);
    expect(H264.FindNextStartCode(NALU2, 12)).toBe(14);
    expect(H264.FindNextStartCode(NALU2, 13)).toBe(14);
    expect(H264.FindNextStartCode(NALU2, 14)).toBe(14);
    expect(H264.FindNextStartCode(NALU2, 15)).toBe(14);
  });

  it("FindNextStartCodeEnd", () => {
    const NALU1 = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x02, 0x03]);

    expect(H264.FindNextStartCodeEnd(NALU1, 0)).toBe(0 + 4);
    expect(H264.FindNextStartCodeEnd(NALU1, 1)).toBe(1 + 3);
    expect(H264.FindNextStartCodeEnd(NALU1, 2)).toBe(6);
    expect(H264.FindNextStartCodeEnd(NALU1, 3)).toBe(6);
    expect(H264.FindNextStartCodeEnd(NALU1, 4)).toBe(6);
    expect(H264.FindNextStartCodeEnd(NALU1, 5)).toBe(6);
    expect(H264.FindNextStartCodeEnd(NALU1, 6)).toBe(6);
    expect(H264.FindNextStartCodeEnd(NALU1, 7)).toBe(6);

    const NALU2 = new Uint8Array([
      0x00, 0x01, 0x03, 0x0a, 0x00, 0x00, 0x01, 0x0b, 0x0c, 0x00, 0x00, 0x00, 0x01, 0x0d,
    ]);
    expect(H264.FindNextStartCodeEnd(NALU2, 0)).toBe(4 + 3);
    expect(H264.FindNextStartCodeEnd(NALU2, 1)).toBe(4 + 3);
    expect(H264.FindNextStartCodeEnd(NALU2, 2)).toBe(4 + 3);
    expect(H264.FindNextStartCodeEnd(NALU2, 3)).toBe(4 + 3);
    expect(H264.FindNextStartCodeEnd(NALU2, 4)).toBe(4 + 3);
    expect(H264.FindNextStartCodeEnd(NALU2, 5)).toBe(9 + 4);
    expect(H264.FindNextStartCodeEnd(NALU2, 6)).toBe(9 + 4);
    expect(H264.FindNextStartCodeEnd(NALU2, 7)).toBe(9 + 4);
    expect(H264.FindNextStartCodeEnd(NALU2, 8)).toBe(9 + 4);
    expect(H264.FindNextStartCodeEnd(NALU2, 9)).toBe(9 + 4);
    expect(H264.FindNextStartCodeEnd(NALU2, 10)).toBe(10 + 3);
    expect(H264.FindNextStartCodeEnd(NALU2, 11)).toBe(14);
    expect(H264.FindNextStartCodeEnd(NALU2, 12)).toBe(14);
    expect(H264.FindNextStartCodeEnd(NALU2, 13)).toBe(14);
    expect(H264.FindNextStartCodeEnd(NALU2, 14)).toBe(14);
    expect(H264.FindNextStartCodeEnd(NALU2, 15)).toBe(14);
  });

  it("GetFirstNALUOfType", () => {
    const INPUT = new Uint8Array([
      0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0x00, 0x0a, 0xf8, 0x41, 0xa2, 0x00, 0x00, 0x00, 0x01,
      0xff,
    ]);

    const nalu = H264.GetFirstNALUOfType(INPUT, 7); // SPS
    expect(nalu).not.toBeUndefined();
    expect(nalu!.byteLength).toBe(7);
    expect(nalu![0]).toBe(0x67);
  });

  it("ParseDecoderConfig", () => {
    const NALU = new Uint8Array([
      0x00, 0x00, 0x01, 0x67, 0x64, 0x0, 0x1e, 0xac, 0xb2, 0x1, 0x40, 0x5f, 0xf2, 0xe0, 0x2d, 0x40,
      0x40, 0x40, 0x50, 0x0, 0x0, 0x3, 0x0, 0x10, 0x0, 0x0, 0x3, 0x3, 0x20, 0xf1, 0x62, 0xe4, 0x80,
    ]);
    const decoderConfig = H264.ParseDecoderConfig(NALU);
    expect(decoderConfig).toEqual({
      codec: "avc1.64001E",
      codedWidth: 640,
      codedHeight: 368,
    });
  });
});
