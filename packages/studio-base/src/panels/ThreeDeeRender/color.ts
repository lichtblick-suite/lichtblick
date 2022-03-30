// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { clamp } from "three/src/math/MathUtils";

import { approxEquals, uint8Equals } from "./math";
import { ColorRGBA } from "./ros";

export function SRGBToLinear(c: number): number {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}

export function rgbaToHexString(color: ColorRGBA): string {
  const rgba =
    (clamp(color.r * 255, 0, 255) << 24) ^
    (clamp(color.g * 255, 0, 255) << 16) ^
    (clamp(color.b * 255, 0, 255) << 8) ^
    (clamp(color.a * 255, 0, 255) << 0);
  return ("00000000" + rgba.toString(16)).slice(-8);
}

export function rgbaEqual(a: ColorRGBA, b: ColorRGBA): boolean {
  return (
    uint8Equals(a.r, b.r) &&
    uint8Equals(a.g, b.g) &&
    uint8Equals(a.b, b.b) &&
    approxEquals(a.a, b.a)
  );
}
