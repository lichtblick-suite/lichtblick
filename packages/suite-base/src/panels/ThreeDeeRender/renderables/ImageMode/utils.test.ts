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
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";

import { mapRange, clampBrightness, clampContrast } from "./utils";

describe("mapRange", () => {
  it("maps value correctly within range", () => {
    const result = mapRange(50, 0, 100, 0, 200);
    expect(result).toBe(100);
  });

  it("clamps value to inMax if above", () => {
    const result = mapRange(150, 0, 100, 0, 200);
    expect(result).toBe(200);
  });

  it("clamps value to inMin if below", () => {
    const result = mapRange(-50, 0, 100, 0, 200);
    expect(result).toBe(0);
  });

  it("returns outMin if inMin === inMax to avoid division by zero", () => {
    const result = mapRange(50, 100, 100, 0, 200);
    expect(result).toBe(0);
  });

  it("maps correctly when in range", () => {
    const result = mapRange(25, 0, 100, 0, 50);
    expect(result).toBe(12.5);
  });

  it("should return outMin value when inMin and inMax are equal", () => {
    const repeatedValue = BasicBuilder.number();
    const outMin = BasicBuilder.number();
    const result = mapRange(75, repeatedValue, repeatedValue, outMin, 200);
    expect(result).toBe(outMin);
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

  it("clamps brightness bclampBrightness(-10)elow minimum", () => {
    const result = clampBrightness(-10);
    expect(result).toBe(LOWER_BRIGHTNESS_LIMIT);
  });

  it("clamps brightness above maximum", () => {
    const result = clampBrightness(150);
    expect(result).toBe(UPPER_BRIGHTNESS_LIMIT);
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
    const result = clampContrast(-20);
    expect(result).toBe(LOWER_CONTRAST_LIMIT);
  });

  it("clamps contrast above maximum", () => {
    const result = clampContrast(120);
    expect(result).toBe(UPPER_CONTRAST_LIMIT);
  });
});
