// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "@foxglove/studio";

/**
 * Describes the limits of a rectangular area in 2d space.
 */
export type Bounds = {
  x: { min: number; max: number };
  y: { min: number; max: number };
};

/**
 * Creates inverted bounds with values set to extremes to simplify calculating the union
 * with a series of other bounds.
 */
export function makeInvertedBounds(): Bounds {
  return {
    x: { min: Number.MAX_SAFE_INTEGER, max: Number.MIN_SAFE_INTEGER },
    y: { min: Number.MAX_SAFE_INTEGER, max: Number.MIN_SAFE_INTEGER },
  };
}

/**
 * Finds the union of two rectangular bounds.
 */
export function unionBounds(a: Immutable<Bounds>, b: Immutable<Bounds>): Bounds {
  return {
    x: { min: Math.min(a.x.min, b.x.min), max: Math.max(a.x.max, b.x.max) },
    y: { min: Math.min(a.y.min, b.y.min), max: Math.max(a.y.max, b.y.max) },
  };
}
