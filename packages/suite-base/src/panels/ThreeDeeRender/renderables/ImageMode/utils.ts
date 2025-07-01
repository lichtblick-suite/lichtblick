// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  LOWER_BRIGHTNESS_LIMIT,
  LOWER_CONTRAST_LIMIT,
  MAX_BRIGHTNESS,
  MAX_CONTRAST,
  MIN_BRIGHTNESS,
  MIN_CONTRAST,
  UPPER_BRIGHTNESS_LIMIT,
  UPPER_CONTRAST_LIMIT,
} from "@lichtblick/suite-base/panels/ThreeDeeRender/renderables/ImageMode/constants";

export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  // Avoid division by 0
  if (inMin === inMax) {
    return outMin;
  }

  const clamped = Math.min(Math.max(value, inMin), inMax);
  return ((clamped - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

export function clampBrightness(value: number): number {
  return mapRange(
    value,
    MIN_BRIGHTNESS,
    MAX_BRIGHTNESS,
    LOWER_BRIGHTNESS_LIMIT,
    UPPER_BRIGHTNESS_LIMIT,
  );
}

export function clampContrast(value: number): number {
  return mapRange(value, MIN_CONTRAST, MAX_CONTRAST, LOWER_CONTRAST_LIMIT, UPPER_CONTRAST_LIMIT);
}
