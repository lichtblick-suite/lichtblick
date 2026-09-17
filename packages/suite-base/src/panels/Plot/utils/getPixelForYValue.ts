// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { YScale } from "@lichtblick/suite-base/panels/Plot/types";

/**
 * Get the canvas pixel y location for the plot y value.
 *
 * Unlike the x axis, larger y values sit at the smaller (top) pixel, so the interpolation
 * direction is inverted.
 */
export function getPixelForYValue(
  scale: YScale | undefined,
  yValue: number | undefined,
): number | undefined {
  if (!scale || yValue == undefined) {
    return undefined;
  }

  const pixelRange = scale.bottom - scale.top;
  if (pixelRange <= 0) {
    return undefined;
  }

  if (yValue < scale.min || yValue > scale.max) {
    return undefined;
  }

  // Linear interpolation, inverted: yValue===min maps to the bottom pixel.
  return scale.bottom - ((yValue - scale.min) / (scale.max - scale.min)) * pixelRange;
}
