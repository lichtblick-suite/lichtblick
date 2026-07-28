// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * A minimal PNG decoder for single channel (grayscale) images.
 *
 * `createImageBitmap` cannot be used for depth images: the browser always hands back 8 bit RGBA
 * samples, which would throw away half of the precision of the 16 bit values that
 * `compressed_depth_image_transport` stores. This decoder keeps the samples intact.
 *
 * Only the subset of PNG that OpenCV's `imencode` produces for a single channel `Mat` is
 * supported, which is what every ROS depth image publisher goes through.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** PNG color type 0, the only one this decoder handles. */
const COLOR_TYPE_GRAYSCALE = 0;

const IHDR_LENGTH = 13;

export type GrayscalePng = {
  width: number;
  height: number;
  bitDepth: 8 | 16;
  /**
   * Tightly packed sample data, `width * bitDepth / 8` bytes per row. 16 bit samples stay in the
   * big-endian byte order that PNG mandates.
   */
  data: Uint8Array;
};

/**
 * Decodes a grayscale PNG into its raw samples.
 *
 * @throws if the image is not a non-interlaced 8 or 16 bit grayscale PNG.
 */
export async function decodeGrayscalePng(png: Uint8Array): Promise<GrayscalePng> {
  const header = readHeader(png);
  const { width, height, bitDepth } = header;

  const inflated = await inflate(concatIdat(png, header.firstChunkOffset));

  const bytesPerSample = bitDepth / 8;
  const bytesPerRow = width * bytesPerSample;
  // Every scanline is prefixed with the filter type that was applied to it.
  const expectedLength = (bytesPerRow + 1) * height;
  if (inflated.length < expectedLength) {
    throw new Error(
      `PNG image data is truncated (expected ${expectedLength} bytes, got ${inflated.length})`,
    );
  }

  return { width, height, bitDepth, data: unfilter(inflated, bytesPerRow, height, bytesPerSample) };
}

type PngHeader = {
  width: number;
  height: number;
  bitDepth: 8 | 16;
  /** Offset of the chunk following IHDR. */
  firstChunkOffset: number;
};

function readHeader(png: Uint8Array): PngHeader {
  if (png.length < PNG_SIGNATURE.length + 8 + IHDR_LENGTH) {
    throw new Error("Not a PNG image (too short)");
  }
  for (const [index, byte] of PNG_SIGNATURE.entries()) {
    if (png[index] !== byte) {
      throw new Error("Not a PNG image (bad signature)");
    }
  }

  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  // The IHDR chunk is required to be the first one, immediately after the signature.
  const ihdrStart = PNG_SIGNATURE.length;
  if (readChunkType(png, ihdrStart + 4) !== "IHDR") {
    throw new Error("Invalid PNG (missing IHDR chunk)");
  }
  const ihdr = ihdrStart + 8;

  const width = view.getUint32(ihdr);
  const height = view.getUint32(ihdr + 4);
  const bitDepth = view.getUint8(ihdr + 8);
  const colorType = view.getUint8(ihdr + 9);
  const compressionMethod = view.getUint8(ihdr + 10);
  const filterMethod = view.getUint8(ihdr + 11);
  const interlaceMethod = view.getUint8(ihdr + 12);

  if (colorType !== COLOR_TYPE_GRAYSCALE) {
    throw new Error(`Unsupported PNG color type ${colorType}, only grayscale is supported`);
  }
  if (bitDepth !== 8 && bitDepth !== 16) {
    throw new Error(`Unsupported PNG bit depth ${bitDepth}, only 8 and 16 are supported`);
  }
  if (compressionMethod !== 0 || filterMethod !== 0) {
    throw new Error("Unsupported PNG compression or filter method");
  }
  if (interlaceMethod !== 0) {
    throw new Error("Interlaced PNG images are not supported");
  }
  if (width === 0 || height === 0) {
    throw new Error("PNG image has zero width or height");
  }

  return { width, height, bitDepth, firstChunkOffset: ihdr + IHDR_LENGTH + 4 };
}

function readChunkType(png: Uint8Array, offset: number): string {
  return String.fromCharCode(png[offset]!, png[offset + 1]!, png[offset + 2]!, png[offset + 3]!);
}

/** Image data may be split over any number of IDAT chunks that together form one zlib stream. */
function concatIdat(png: Uint8Array, firstChunkOffset: number): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const parts: Uint8Array[] = [];
  let totalLength = 0;

  // Each chunk is a 4 byte length, a 4 byte type, the payload and a 4 byte CRC.
  let offset = firstChunkOffset;
  while (offset + 8 <= png.length) {
    const length = view.getUint32(offset);
    const type = readChunkType(png, offset + 4);
    const dataStart = offset + 8;
    if (dataStart + length > png.length) {
      throw new Error(`Invalid PNG (${type} chunk extends past the end of the image)`);
    }
    if (type === "IDAT") {
      parts.push(png.subarray(dataStart, dataStart + length));
      totalLength += length;
    } else if (type === "IEND") {
      break;
    }
    offset = dataStart + length + 4;
  }

  if (totalLength === 0) {
    throw new Error("Invalid PNG (no IDAT chunks)");
  }
  if (parts.length === 1) {
    return parts[0]!;
  }

  const joined = new Uint8Array(totalLength);
  let position = 0;
  for (const part of parts) {
    joined.set(part, position);
    position += part.length;
  }
  return joined;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  // PNG stores a zlib stream, which is what the "deflate" format of DecompressionStream expects.
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Reverses the per-scanline filtering described in the PNG specification, writing the
 * reconstructed samples into a tightly packed buffer without the filter type bytes.
 *
 * https://www.w3.org/TR/png-3/#9Filters
 */
function unfilter(
  filtered: Uint8Array,
  bytesPerRow: number,
  height: number,
  bytesPerSample: number,
): Uint8Array {
  const output = new Uint8Array(bytesPerRow * height);

  for (let row = 0; row < height; row++) {
    const filterType = filtered[row * (bytesPerRow + 1)]!;
    const rowStart = row * (bytesPerRow + 1) + 1;
    const outStart = row * bytesPerRow;
    const prevStart = outStart - bytesPerRow;

    for (let index = 0; index < bytesPerRow; index++) {
      const raw = filtered[rowStart + index]!;
      // `left` and `upperLeft` are the already reconstructed bytes one pixel back in the row.
      const left = index >= bytesPerSample ? output[outStart + index - bytesPerSample]! : 0;
      const up = row > 0 ? output[prevStart + index]! : 0;
      const upperLeft =
        row > 0 && index >= bytesPerSample ? output[prevStart + index - bytesPerSample]! : 0;

      let value: number;
      switch (filterType) {
        case 0: // None
          value = raw;
          break;
        case 1: // Sub
          value = raw + left;
          break;
        case 2: // Up
          value = raw + up;
          break;
        case 3: // Average
          value = raw + ((left + up) >> 1);
          break;
        case 4: // Paeth
          value = raw + paethPredictor(left, up, upperLeft);
          break;
        default:
          throw new Error(`Unsupported PNG filter type ${filterType} on row ${row}`);
      }
      output[outStart + index] = value & 0xff;
    }
  }

  return output;
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
