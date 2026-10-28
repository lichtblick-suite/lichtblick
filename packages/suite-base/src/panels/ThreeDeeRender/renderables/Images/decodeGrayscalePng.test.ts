// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import GrayscalePngBuilder from "@lichtblick/suite-base/testing/builders/GrayscalePngBuilder";

import { decodeGrayscalePng } from "./decodeGrayscalePng";

const WIDTH = 4;
const HEIGHT = 3;
// Values spread across the whole 16 bit range so any precision loss would show up.
const SAMPLES_16 = [0, 1, 65535, 65534, 30000, 12345, 999, 40000, 65535, 0, 7, 512];

describe("decodeGrayscalePng", () => {
  it.each([0, 1, 2, 3, 4])(
    "should round-trip 16 bit samples filtered with type %i",
    async (filterType) => {
      // GIVEN a 16 bit grayscale PNG encoded with the given scanline filter
      const png = await GrayscalePngBuilder.png(WIDTH, HEIGHT, 16, SAMPLES_16, { filterType });

      // WHEN it is decoded
      const result = await decodeGrayscalePng(png);

      // THEN the full precision samples come back unchanged
      expect(result.width).toBe(WIDTH);
      expect(result.height).toBe(HEIGHT);
      expect(result.bitDepth).toBe(16);
      expect(GrayscalePngBuilder.readSamples(result.data, 16, WIDTH * HEIGHT)).toEqual(SAMPLES_16);
    },
  );

  it("should round-trip 8 bit samples", async () => {
    // GIVEN an 8 bit grayscale PNG
    const samples = [0, 17, 255, 128, 3, 200, 91, 42, 7, 64, 129, 250];
    const png = await GrayscalePngBuilder.png(WIDTH, HEIGHT, 8, samples, { filterType: 4 });

    // WHEN it is decoded
    const result = await decodeGrayscalePng(png);

    // THEN the samples come back unchanged
    expect(result.bitDepth).toBe(8);
    expect(GrayscalePngBuilder.readSamples(result.data, 8, WIDTH * HEIGHT)).toEqual(samples);
  });

  it("should join image data split over several IDAT chunks", async () => {
    // GIVEN a PNG whose compressed stream is split over multiple IDAT chunks
    const png = await GrayscalePngBuilder.png(WIDTH, HEIGHT, 16, SAMPLES_16, { idatChunks: 3 });

    // WHEN it is decoded
    const result = await decodeGrayscalePng(png);

    // THEN the chunks are reassembled into one stream
    expect(GrayscalePngBuilder.readSamples(result.data, 16, WIDTH * HEIGHT)).toEqual(SAMPLES_16);
  });

  it("should reject data that is not a PNG", async () => {
    // GIVEN bytes that do not carry the PNG signature
    const notAPng = new Uint8Array(64).fill(0x42);

    // WHEN it is decoded THEN it is rejected
    await expect(decodeGrayscalePng(notAPng)).rejects.toThrow("Not a PNG image");
  });

  it("should reject color types other than grayscale", async () => {
    // GIVEN a PNG declaring an RGB color type
    const png = await GrayscalePngBuilder.png(WIDTH, HEIGHT, 8, SAMPLES_16, { colorType: 2 });

    // WHEN it is decoded THEN it is rejected
    await expect(decodeGrayscalePng(png)).rejects.toThrow("Unsupported PNG color type 2");
  });

  it("should reject interlaced images", async () => {
    // GIVEN an interlaced PNG
    const png = await GrayscalePngBuilder.png(WIDTH, HEIGHT, 16, SAMPLES_16, { interlace: 1 });

    // WHEN it is decoded THEN it is rejected
    await expect(decodeGrayscalePng(png)).rejects.toThrow(
      "Interlaced PNG images are not supported",
    );
  });

  it("should reject an image without pixel data", async () => {
    // GIVEN a PNG with no IDAT chunk
    const png = await GrayscalePngBuilder.headerOnlyPng(1, 1);

    // WHEN it is decoded THEN it is rejected
    await expect(decodeGrayscalePng(png)).rejects.toThrow("no IDAT chunks");
  });

  it("should reject an image whose scanlines are incomplete", async () => {
    // GIVEN a PNG whose IHDR claims more rows than the compressed data holds
    const png = await GrayscalePngBuilder.png(WIDTH, HEIGHT, 16, SAMPLES_16);
    // Rewrite the height in IHDR, which starts 8 (signature) + 8 (length and type) bytes in.
    new DataView(png.buffer, png.byteOffset).setUint32(20, HEIGHT + 5);

    // WHEN it is decoded THEN it is rejected
    await expect(decodeGrayscalePng(png)).rejects.toThrow("truncated");
  });
});
