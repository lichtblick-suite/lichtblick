// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Scale } from "@lichtblick/suite-base/panels/Plot/types";

/** Get the canvas pixel x location for the plot x value */
export function getPixelForXValue(
  scale: Scale | undefined,
  xValue: number | undefined,
): number | undefined {
  if (!scale || xValue == undefined) {
    return undefined;
  }

  const pixelRange = scale.right - scale.left;
  if (pixelRange <= 0) {
    return undefined;
  }

  if (xValue < scale.min || xValue > scale.max) {
    return undefined;
  }

  // Linear interpolation to place the xValue within min/max
  return scale.left + ((xValue - scale.min) / (scale.max - scale.min)) * pixelRange;
}
