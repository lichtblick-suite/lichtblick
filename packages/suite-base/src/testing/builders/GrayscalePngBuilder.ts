// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Test scaffolding that produces single channel PNG images, the container that
 * `compressed_depth_image_transport` wraps depth images in. Encoding them here keeps the decoder
 * tests free of binary fixtures and lets them cover every scanline filter.
 */

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export type GrayscalePngOptions = {
  /** PNG scanline filter type (0 None, 1 Sub, 2 Up, 3 Average, 4 Paeth) applied to every row. */
  filterType?: number;
  /** Split the compressed stream over this many IDAT chunks. */
  idatChunks?: number;
  /** Overrides the IHDR color type, to build images the decoder should reject. */
  colorType?: number;
  /** Overrides the IHDR interlace method, to build images the decoder should reject. */
  interlace?: number;
};

export default class GrayscalePngBuilder {
  /** Builds a grayscale PNG holding `samples` in row-major order. */
  public static async png(
    width: number,
    height: number,
    bitDepth: 8 | 16,
    samples: ArrayLike<number>,
    options: GrayscalePngOptions = {},
  ): Promise<Uint8Array> {
    const bytesPerSample = bitDepth / 8;
    const bytesPerRow = width * bytesPerSample;
    const raw = new Uint8Array(bytesPerRow * height);
    const view = new DataView(raw.buffer);
    for (let i = 0; i < width * height; i++) {
      if (bitDepth === 16) {
        view.setUint16(i * 2, samples[i]!); // PNG samples are big-endian
      } else {
        view.setUint8(i, samples[i]!);
      }
    }

    const filtered = filterScanlines(
      raw,
      bytesPerRow,
      height,
      bytesPerSample,
      options.filterType ?? 0,
    );
    const compressed = await deflate(filtered);

    const idatCount = options.idatChunks ?? 1;
    const sliceSize = Math.ceil(compressed.length / idatCount);
    const idats = Array.from({ length: idatCount }, (_, i) =>
      GrayscalePngBuilder.chunk("IDAT", compressed.subarray(i * sliceSize, (i + 1) * sliceSize)),
    );

    return concat([
      PNG_SIGNATURE,
      GrayscalePngBuilder.chunk(
        "IHDR",
        ihdr(width, height, bitDepth, options.colorType ?? 0, options.interlace ?? 0),
      ),
      ...idats,
      GrayscalePngBuilder.chunk("IEND", new Uint8Array()),
    ]);
  }

  /** Builds a PNG containing only a header, i.e. one carrying no pixel data at all. */
  public static async headerOnlyPng(width: number, height: number): Promise<Uint8Array> {
    return concat([
      PNG_SIGNATURE,
      GrayscalePngBuilder.chunk("IHDR", ihdr(width, height, 16, 0, 0)),
      GrayscalePngBuilder.chunk("IEND", new Uint8Array()),
    ]);
  }

  /** Wraps `data` in a PNG chunk with a correct length prefix and CRC. */
  public static chunk(type: string, data: Uint8Array): Uint8Array {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) {
      out[4 + i] = type.charCodeAt(i);
    }
    out.set(data, 8);
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  }

  /** Reads back samples encoded by {@link GrayscalePngBuilder.png}. */
  public static readSamples(data: Uint8Array, bitDepth: 8 | 16, count: number): number[] {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    return Array.from({ length: count }, (_, i) =>
      bitDepth === 16 ? view.getUint16(i * 2, false) : view.getUint8(i),
    );
  }
}

function ihdr(
  width: number,
  height: number,
  bitDepth: number,
  colorType: number,
  interlace: number,
): Uint8Array {
  const out = new Uint8Array(13);
  const view = new DataView(out.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  out[8] = bitDepth;
  out[9] = colorType;
  out[10] = 0; // compression method
  out[11] = 0; // filter method
  out[12] = interlace;
  return out;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The inverse of the unfiltering the decoder performs. https://www.w3.org/TR/png-3/#9Filters */
function filterScanlines(
  raw: Uint8Array,
  bytesPerRow: number,
  height: number,
  bytesPerSample: number,
  filterType: number,
): Uint8Array {
  const out = new Uint8Array((bytesPerRow + 1) * height);
  for (let row = 0; row < height; row++) {
    const rowStart = row * bytesPerRow;
    const prevStart = rowStart - bytesPerRow;
    const outStart = row * (bytesPerRow + 1);
    out[outStart] = filterType;

    for (let i = 0; i < bytesPerRow; i++) {
      const x = raw[rowStart + i]!;
      const left = i >= bytesPerSample ? raw[rowStart + i - bytesPerSample]! : 0;
      const up = row > 0 ? raw[prevStart + i]! : 0;
      const upperLeft = row > 0 && i >= bytesPerSample ? raw[prevStart + i - bytesPerSample]! : 0;

      let value: number;
      switch (filterType) {
        case 1:
          value = x - left;
          break;
        case 2:
          value = x - up;
          break;
        case 3:
          value = x - ((left + up) >> 1);
          break;
        case 4:
          value = x - paethPredictor(left, up, upperLeft);
          break;
        default:
          value = x;
      }
      out[outStart + 1 + i] = value & 0xff;
    }
  }
  return out;
}

function paethPredictor(left: number, up: number, upperLeft: number): number {
  const estimate = left + up - upperLeft;
  const distLeft = Math.abs(estimate - left);
  const distUp = Math.abs(estimate - up);
  const distUpperLeft = Math.abs(estimate - upperLeft);
  if (distLeft <= distUp && distLeft <= distUpperLeft) {
    return left;
  }
  return distUp <= distUpperLeft ? up : upperLeft;
}
