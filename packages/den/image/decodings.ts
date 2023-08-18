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

/**
 * Adapted from:
 * https://github.com/ros2/rviz/blob/e8838720e57b56cc0d50e05b00b28bee3c5dc9ee/rviz_default_plugins/src/rviz_default_plugins/displays/image/ros_image_texture.cpp#L332
 */
function yuvToRGBA8(
  y1: number,
  u: number,
  y2: number,
  v: number,
  c: number,
  output: Uint8ClampedArray,
): void {
  // rgba
  output[c] = y1 + Math.trunc((1403 * v) / 1000);
  output[c + 1] = y1 - Math.trunc((344 * u) / 1000) - Math.trunc((714 * v) / 1000);
  output[c + 2] = y1 + Math.trunc((1770 * u) / 1000);
  output[c + 3] = 255;

  // rgba
  output[c + 4] = y2 + Math.trunc((1403 * v) / 1000);
  output[c + 5] = y2 - Math.trunc((344 * u) / 1000) - Math.trunc((714 * v) / 1000);
  output[c + 6] = y2 + Math.trunc((1770 * u) / 1000);
  output[c + 7] = 255;
}

export function decodeUYVY(
  uyvy: Uint8Array,
  width: number,
  height: number,
  step: number,
  output: Uint8ClampedArray,
): void {
  if (step < width * 2) {
    throw new Error(`UYVY image row step (${step}) must be at least 2*width (${width * 2})`);
  }
  let outIdx = 0;

  // populate 2 pixels at a time
  for (let row = 0; row < height; row++) {
    const rowStart = row * step;
    for (let col = 0; col < width; col += 2) {
      const off = rowStart + col * 2;
      const u = uyvy[off]! - 128;
      const y1 = uyvy[off + 1]!;
      const v = uyvy[off + 2]! - 128;
      const y2 = uyvy[off + 3]!;
      yuvToRGBA8(y1, u, y2, v, outIdx, output);
      outIdx += 8;
    }
  }
}

export function decodeYUYV(
  yuyv: Uint8Array,
  width: number,
  height: number,
  step: number,
  output: Uint8ClampedArray,
): void {
  if (step < width * 2) {
    throw new Error(`YUYV image row step (${step}) must be at least 2*width (${width * 2})`);
  }
  let outIdx = 0;

  // populate 2 pixels at a time
  for (let row = 0; row < height; row++) {
    const rowStart = row * step;
    for (let col = 0; col < width; col += 2) {
      const off = rowStart + col * 2;
      const y1 = yuyv[off]!;
      const u = yuyv[off + 1]! - 128;
      const y2 = yuyv[off + 2]!;
      const v = yuyv[off + 3]! - 128;
      yuvToRGBA8(y1, u, y2, v, outIdx, output);
      outIdx += 8;
    }
  }
}

export function decodeRGB8(
  rgb: Uint8Array,
  width: number,
  height: number,
  step: number,
  output: Uint8ClampedArray,
): void {
  if (step < width * 3) {
    throw new Error(`RGB8 image row step (${step}) must be at least 3*width (${width * 3})`);
  }
  let outIdx = 0;

  for (let row = 0; row < height; row++) {
    const rowStart = row * step;
    for (let col = 0; col < width; col++) {
      const inIdx = rowStart + col * 3;
      const r = rgb[inIdx]!;
      const g = rgb[inIdx + 1]!;
      const b = rgb[inIdx + 2]!;

      output[outIdx++] = r;
      output[outIdx++] = g;
      output[outIdx++] = b;
      output[outIdx++] = 255;
    }
  }
}

export function decodeRGBA8(
  rgba: Uint8Array,
  width: number,
  height: number,
  step: number,
  output: Uint8ClampedArray,
): void {
  if (step < width * 4) {
    throw new Error(`RGBA8 image row step (${step}) must be at least 4*width (${width * 4})`);
  }
  let outIdx = 0;

  for (let row = 0; row < height; row++) {
    const rowStart = row * step;
    for (let col = 0; col < width; col++) {
      const inIdx = rowStart + col * 4;
      const r = rgba[inIdx]!;
      const g = rgba[inIdx + 1]!;
      const b = rgba[inIdx + 2]!;
      const a = rgba[inIdx + 3]!;

      output[outIdx++] = r;
      output[outIdx++] = g;
      output[outIdx++] = b;
      output[outIdx++] = a;
    }
  }
}

export function decodeBGRA8(
  rgba: Uint8Array,
  width: number,
  height: number,
  step: number,
  output: Uint8ClampedArray,
): void {
  if (step < width * 4) {
    throw new Error(`BGRA8 image row step (${step}) must be at least 4*width (${width * 4})`);
  }
  let outIdx = 0;

  for (let row = 0; row < height; row++) {
    const rowStart = row * step;
    for (let col = 0; col < width; col++) {
      const inIdx = rowStart + col * 4;
      const b = rgba[inIdx]!;
      const g = rgba[inIdx + 1]!;
      const r = rgba[inIdx + 2]!;
      const a = rgba[inIdx + 3]!;

      output[outIdx++] = r;
      output[outIdx++] = g;
      output[outIdx++] = b;
      output[outIdx++] = a;
    }
  }
}

export function decodeBGR8(
  bgr: Uint8Array,
  width: number,
  height: number,
  step: number,
  output: Uint8ClampedArray,
): void {
  if (step < width * 3) {
    throw new Error(`BGR8 image row step (${step}) must be at least 3*width (${width * 3})`);
  }
  let outIdx = 0;

  for (let row = 0; row < height; row++) {
    const rowStart = row * step;
    for (let col = 0; col < width; col++) {
      const inIdx = rowStart + col * 3;
      const b = bgr[inIdx]!;
      const g = bgr[inIdx + 1]!;
      const r = bgr[inIdx + 2]!;

      output[outIdx++] = r;
      output[outIdx++] = g;
      output[outIdx++] = b;
      output[outIdx++] = 255;
    }
  }
}

export function decodeFloat1c(
  gray: Uint8Array,
  width: number,
  height: number,
  step: number,
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  is_bigendian: boolean,
  output: Uint8ClampedArray,
): void {
  if (step < width * 4) {
    throw new Error(`Float image row step (${step}) must be at least 4*width (${width * 4})`);
  }
  const view = new DataView(gray.buffer, gray.byteOffset);

  let outIdx = 0;
  for (let row = 0; row < height; row++) {
    const rowStart = row * step;
    for (let col = 0; col < width; col++) {
      const val = view.getFloat32(rowStart + col * 4, !is_bigendian) * 255;
      output[outIdx++] = val;
      output[outIdx++] = val;
      output[outIdx++] = val;
      output[outIdx++] = 255;
    }
  }
}

export function decodeMono8(
  mono8: Uint8Array,
  width: number,
  height: number,
  step: number,
  output: Uint8ClampedArray,
): void {
  if (step < width) {
    throw new Error(`Uint8 image row step (${step}) must be at least width (${width})`);
  }
  let outIdx = 0;

  for (let row = 0; row < height; row++) {
    const rowStart = row * step;
    for (let col = 0; col < width; col++) {
      const ch = mono8[rowStart + col]!;
      output[outIdx++] = ch;
      output[outIdx++] = ch;
      output[outIdx++] = ch;
      output[outIdx++] = 255;
    }
  }
}

export function decodeMono16(
  mono16: Uint8Array,
  width: number,
  height: number,
  step: number,
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  is_bigendian: boolean,
  output: Uint8ClampedArray,
  options?: {
    minValue?: number;
    maxValue?: number;
    colorConverter?: (value: number) => { r: number; g: number; b: number; a: number };
  },
): void {
  if (step < width * 2) {
    throw new Error(`RGBA8 image row step (${step}) must be at least 2*width (${width * 2})`);
  }
  const view = new DataView(mono16.buffer, mono16.byteOffset);

  // Use user-provided max/min values, or default to 0-10000, consistent with image_view's default.
  // References:
  // https://github.com/ros-perception/image_pipeline/blob/42266892502427eb566a4dffa61b009346491ce7/image_view/src/nodes/image_view.cpp#L80-L88
  // https://github.com/ros-visualization/rqt_image_view/blob/fe076acd265a05c11c04f9d04392fda951878f54/src/rqt_image_view/image_view.cpp#L582
  // https://github.com/ros-visualization/rviz/blob/68b464fb6571b8760f91e8eca6fb933ba31190bf/src/rviz/image/ros_image_texture.cpp#L114
  const minValue = options?.minValue ?? 0;
  let maxValue = options?.maxValue ?? 10000;
  if (maxValue === minValue) {
    maxValue = minValue + 1;
  }
  const converter = options?.colorConverter;

  let outIdx = 0;
  for (let row = 0; row < height; row++) {
    const rowStart = row * step;
    for (let col = 0; col < width; col++) {
      let val = view.getUint16(rowStart + col * 2, !is_bigendian);

      if (converter) {
        const { r, g, b } = converter(val);

        output[outIdx++] = r * 255;
        output[outIdx++] = g * 255;
        output[outIdx++] = b * 255;
      } else {
        // 0 - 1.0
        val = (val - minValue) / (maxValue - minValue);
        val *= 255;

        output[outIdx++] = val;
        output[outIdx++] = val;
        output[outIdx++] = val;
      }
      output[outIdx++] = 255;
    }
  }
}

// Specialize the Bayer decode function to a certain encoding. For performance reasons, we use
// new Function() -- this is about 20% faster than a switch statement and .bind().
function makeSpecializedDecodeBayer(
  tl: string,
  tr: string,
  bl: string,
  br: string,
): (
  data: Uint8Array,
  width: number,
  height: number,
  step: number,
  output: Uint8ClampedArray,
) => void {
  // We probably can't afford real debayering/demosaicking, so do something simpler
  // The input array look like a single-plane array of pixels.  However, each pixel represents a one particular color
  // for a group of pixels in the 2x2 region.  For 'rggb', there color representatio for the 2x2 region looks like:
  //
  // R  | G0
  // -------
  // G1 | B
  //
  // In other words, a 2x2 region is represented by one R value, one B value, and two G values.  In sophisticated
  // algorithms, each color will be weighted and interpolated to fill in the missing colors for the pixels.  These
  // algorithms may reach beyond the local 2x2 region and use values from neighboring regions.
  //
  // We'll do something much simpler.  For each group of 2x2, we're replicate the R and B values for all pixels.
  // For the two row, we'll replicate G0 for the green channels, and replicate G1 for the bottom row.
  // eslint-disable-next-line no-new-func
  return new Function(
    "data",
    "width",
    "height",
    "step",
    "output",
    /* js */ `
  if (step < width) {
    throw new Error(\`Bayer image row step (\${step}) must be at least width (\${width})\`);
  }
  for (let i = 0; i < height / 2; i++) {
    let inIdx = i * 2 * step;
    let outTopIdx = i * 2 * width * 4; // Addresses top row
    let outBottomIdx = (i * 2 + 1) * width * 4; // Addresses bottom row
    for (let j = 0; j < width / 2; j++) {
      const tl = data[inIdx++];
      const tr = data[inIdx++];
      const bl = data[inIdx + step - 2];
      const br = data[inIdx + step - 1];

      const ${tl} = tl;
      const ${tr} = tr;
      const ${bl} = bl;
      const ${br} = br;

      // Top row
      output[outTopIdx++] = r;
      output[outTopIdx++] = g0;
      output[outTopIdx++] = b;
      output[outTopIdx++] = 255;

      output[outTopIdx++] = r;
      output[outTopIdx++] = g0;
      output[outTopIdx++] = b;
      output[outTopIdx++] = 255;

      // Bottom row
      output[outBottomIdx++] = r;
      output[outBottomIdx++] = g1;
      output[outBottomIdx++] = b;
      output[outBottomIdx++] = 255;

      output[outBottomIdx++] = r;
      output[outBottomIdx++] = g1;
      output[outBottomIdx++] = b;
      output[outBottomIdx++] = 255;
    }
  }`,
  ) as ReturnType<typeof makeSpecializedDecodeBayer>;
}

export const decodeBayerRGGB8 = makeSpecializedDecodeBayer("r", "g0", "g1", "b");
export const decodeBayerBGGR8 = makeSpecializedDecodeBayer("b", "g0", "g1", "r");
export const decodeBayerGBRG8 = makeSpecializedDecodeBayer("g0", "b", "r", "g1");
export const decodeBayerGRBG8 = makeSpecializedDecodeBayer("g0", "r", "b", "g1");
