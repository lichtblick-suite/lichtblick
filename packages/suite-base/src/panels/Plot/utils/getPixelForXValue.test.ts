// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BasicBuilder } from "@lichtblick/test-builders";

import { getPixelForXValue } from "./getPixelForXValue";
import type { Scale } from "../types";

describe("getPixelForXValue", () => {
  const scale: Scale = { left: 0, right: 100, min: 0, max: 50 };

  it("returns undefined if scale is undefined", () => {
    const result = getPixelForXValue(undefined, BasicBuilder.number());
    expect(result).toBeUndefined();
  });

  it("returns undefined if xValue is undefined", () => {
    const result = getPixelForXValue(scale, undefined);
    expect(result).toBeUndefined();
  });

  it("returns undefined if xValue is out of scale range", () => {
    const result = getPixelForXValue({ left: 0, right: 100, min: 0, max: 100 }, 200);
    expect(result).toBeUndefined();
  });

  it("returns correct pixel value for valid xValue and scale", () => {
    const xValue = (scale.min + scale.max) / 2;
    const result = getPixelForXValue(scale, xValue);
    const expected =
      scale.left + ((xValue - scale.min) / (scale.max - scale.min)) * (scale.right - scale.left);
    expect(result).toBeCloseTo(expected);
  });

  it("returns correct pixel value for xValue at the minimum of the scale", () => {
    const result = getPixelForXValue(scale, scale.min);
    expect(result).toBe(scale.left);
  });

  it("returns correct pixel value for xValue at the maximum of the scale", () => {
    const result = getPixelForXValue(scale, scale.max);
    expect(result).toBe(scale.right);
  });

  it("returns undefined if pixelRange is less than or equal to 0", () => {
    const zeroPixelRangeScale: Scale = { left: 100, right: 100, min: 0, max: 100 };
    const result = getPixelForXValue(zeroPixelRangeScale, BasicBuilder.number());
    expect(result).toBeUndefined();
  });
});
