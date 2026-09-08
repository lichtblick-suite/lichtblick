// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BasicBuilder } from "@lichtblick/test-builders";

import { getPixelForYValue } from "./getPixelForYValue";
import type { YScale } from "../types";

describe("getPixelForYValue", () => {
  const scale: YScale = { top: 0, bottom: 100, min: 0, max: 50 };

  it("returns undefined if scale is undefined", () => {
    // Given
    const yValue = BasicBuilder.number();

    // When
    const result = getPixelForYValue(undefined, yValue);

    // Then
    expect(result).toBeUndefined();
  });

  it("returns undefined if yValue is undefined", () => {
    // Given / When
    const result = getPixelForYValue(scale, undefined);

    // Then
    expect(result).toBeUndefined();
  });

  it("returns undefined if yValue is out of scale range", () => {
    // Given
    const outOfRangeScale: YScale = { top: 0, bottom: 100, min: 0, max: 100 };

    // When
    const result = getPixelForYValue(outOfRangeScale, 200);

    // Then
    expect(result).toBeUndefined();
  });

  it("returns the bottom pixel for yValue at the minimum of the scale", () => {
    // Given / When
    const result = getPixelForYValue(scale, scale.min);

    // Then
    expect(result).toBe(scale.bottom);
  });

  it("returns the top pixel for yValue at the maximum of the scale", () => {
    // Given / When
    const result = getPixelForYValue(scale, scale.max);

    // Then
    expect(result).toBe(scale.top);
  });

  it("returns the correct pixel value for a yValue halfway through the scale", () => {
    // Given
    const yValue = (scale.min + scale.max) / 2;

    // When
    const result = getPixelForYValue(scale, yValue);

    // Then
    const expected =
      scale.bottom -
      ((yValue - scale.min) / (scale.max - scale.min)) *
        (scale.bottom - scale.top);
    expect(result).toBeCloseTo(expected);
  });

  it("returns undefined if pixelRange is less than or equal to 0", () => {
    // Given
    const zeroPixelRangeScale: YScale = {
      top: 100,
      bottom: 100,
      min: 0,
      max: 100,
    };

    // When
    const result = getPixelForYValue(
      zeroPixelRangeScale,
      BasicBuilder.number(),
    );

    // Then
    expect(result).toBeUndefined();
  });
});
