// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "@lichtblick/suite";

export type Bounds1D = {
  min: number;
  max: number;
};

/**
 * Describes the limits of a rectangular area in 2d space.
 */
export type Bounds = {
  x: Bounds1D;
  y: Bounds1D;
};

/**
 * Return the union of two 1D bounds
 */
export function unionBounds1D(a: Immutable<Bounds1D>, b: Immutable<Bounds1D>): Bounds1D {
  return { min: Math.min(a.min, b.min), max: Math.max(a.max, b.max) };
}

/**
 * Update the bounds to include the value. The bounds are updated in-place. Returns the same bounds
 * object.
 */
export function extendBounds1D(bounds: Bounds1D, value: number): void {
  bounds.min = Math.min(bounds.min, value);
  bounds.max = Math.max(bounds.max, value);
}
