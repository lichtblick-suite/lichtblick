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

import { mapRange, clampBrightness, clampContrast } from "./utils";

describe("mapRange", () => {
  it("maps value correctly within range", () => {
    expect(mapRange(50, 0, 100, 0, 200)).toBe(100);
  });

  it("clamps value to inMax if above", () => {
    expect(mapRange(150, 0, 100, 0, 200)).toBe(200);
  });

  it("clamps value to inMin if below", () => {
    expect(mapRange(-50, 0, 100, 0, 200)).toBe(0);
  });

  it("returns outMin if inMin === inMax to avoid division by zero", () => {
    expect(mapRange(50, 100, 100, 0, 200)).toBe(0);
  });

  it("maps correctly when in range", () => {
    expect(mapRange(25, 0, 100, 0, 50)).toBe(12.5);
  });
});

describe("clampBrightness", () => {
  it("maps brightness within limits", () => {
    const result = mapRange(
      50,
      MIN_BRIGHTNESS,
      MAX_BRIGHTNESS,
      LOWER_BRIGHTNESS_LIMIT,
      UPPER_BRIGHTNESS_LIMIT,
    );
    expect(clampBrightness(50)).toBe(result);
  });

  it("clamps brightness below minimum", () => {
    expect(clampBrightness(-10)).toBe(LOWER_BRIGHTNESS_LIMIT);
  });

  it("clamps brightness above maximum", () => {
    expect(clampBrightness(150)).toBe(UPPER_BRIGHTNESS_LIMIT);
  });
});

describe("clampContrast", () => {
  it("maps contrast within limits", () => {
    const result = mapRange(
      50,
      MIN_CONTRAST,
      MAX_CONTRAST,
      LOWER_CONTRAST_LIMIT,
      UPPER_CONTRAST_LIMIT,
    );
    expect(clampContrast(50)).toBe(result);
  });

  it("clamps contrast below minimum", () => {
    expect(clampContrast(-20)).toBe(LOWER_CONTRAST_LIMIT);
  });

  it("clamps contrast above maximum", () => {
    expect(clampContrast(120)).toBe(UPPER_CONTRAST_LIMIT);
  });
});
