// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { geometricMean, linearRegressionSlope, trapezoidIntegral } from "./numeric";

describe("linearRegressionSlope", () => {
  it("should return the exact slope of collinear points", () => {
    // Given
    const points = [
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
    ];

    // When
    const slope = linearRegressionSlope(points);

    // Then
    expect(slope).toBe(2);
  });

  it("should return the least-squares slope of noisy points regardless of order", () => {
    // Given: y = x with +/-1 noise around it
    const points = [
      { x: 3, y: 2 },
      { x: 0, y: 1 },
      { x: 2, y: 3 },
      { x: 1, y: 0 },
    ];

    // When
    const slope = linearRegressionSlope(points);

    // Then
    expect(slope).toBeCloseTo(0.6, 10);
  });

  it("should return 0 for a flat series", () => {
    // Given
    const points = [
      { x: 0, y: 7 },
      { x: 5, y: 7 },
      { x: 9, y: 7 },
    ];

    // When / Then
    expect(linearRegressionSlope(points)).toBe(0);
  });

  it.each([
    ["no points", []],
    ["one point", [{ x: 1, y: 1 }]],
    [
      "no x variance",
      [
        { x: 2, y: 1 },
        { x: 2, y: 5 },
      ],
    ],
  ])("should return undefined with %s", (_label, points) => {
    // Given / When / Then
    expect(linearRegressionSlope(points)).toBeUndefined();
  });
});

describe("trapezoidIntegral", () => {
  it("should integrate a piecewise linear series between its first and last point", () => {
    // Given: 0 -> 2 over [0, 2], then flat 2 over [2, 3]
    const points = [
      { x: 0, y: 0 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ];

    // When
    const area = trapezoidIntegral(points);

    // Then
    expect(area).toBe(4);
  });

  it("should handle uneven spacing", () => {
    // Given
    const points = [
      { x: 0, y: 100 },
      { x: 0.5, y: 100 },
      { x: 2, y: 50 },
    ];

    // When
    const area = trapezoidIntegral(points);

    // Then
    expect(area).toBe(50 + 112.5);
  });

  it.each([[[]], [[{ x: 1, y: 5 }]]])("should return 0 with fewer than 2 points", (points) => {
    // Given / When / Then
    expect(trapezoidIntegral(points)).toBe(0);
  });
});

describe("geometricMean", () => {
  it("should ignore undefined, non-positive and non-finite values and report n", () => {
    // Given
    const values = [1, 100, undefined, 0, -5, Number.NaN, Infinity];

    // When
    const result = geometricMean(values);

    // Then
    expect(result.n).toBe(2);
    expect(result.value).toBeCloseTo(10, 10);
  });

  it("should be undefined without usable values", () => {
    // Given / When / Then
    expect(geometricMean([undefined, 0])).toEqual({ n: 0 });
  });
});
