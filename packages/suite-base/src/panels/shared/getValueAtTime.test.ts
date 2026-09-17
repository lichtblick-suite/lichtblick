// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ChartDatum } from "@lichtblick/suite-base/components/TimeBasedChart/types";
import { BasicBuilder } from "@lichtblick/test-builders";

import { getValueAtTime } from "./getValueAtTime";

describe("getValueAtTime", () => {
  function buildDatum(overrides: Partial<ChartDatum> = {}): ChartDatum {
    return {
      x: BasicBuilder.number(),
      y: 0,
      value: BasicBuilder.string(),
      ...overrides,
    };
  }

  it("should return undefined for empty data", () => {
    // Given / When
    const result = getValueAtTime([], 10);

    // Then
    expect(result).toBeUndefined();
  });

  it("should return undefined when time is before the first point", () => {
    // Given
    const data = [buildDatum({ x: 5, value: "IDLE" })];

    // When
    const result = getValueAtTime(data, 1);

    // Then
    expect(result).toBeUndefined();
  });

  it("should return the value of the point exactly at time", () => {
    // Given
    const data = [buildDatum({ x: 5, value: "IDLE" })];

    // When
    const result = getValueAtTime(data, 5);

    // Then
    expect(result).toEqual({
      value: "IDLE",
      constantName: undefined,
    });
  });

  it("should return the latest point at or before time", () => {
    // Given
    const data = [
      buildDatum({ x: 1, value: "IDLE" }),
      buildDatum({ x: 5, value: "RUNNING" }),
      buildDatum({ x: 20, value: "DONE" }),
    ];

    // When
    const result = getValueAtTime(data, 10);

    // Then
    expect(result).toEqual({
      value: "RUNNING",
      constantName: undefined,
    });
  });

  it("should include the constantName when present", () => {
    // Given
    const data = [buildDatum({ x: 1, value: 0, constantName: "IDLE" })];

    // When
    const result = getValueAtTime(data, 1);

    // Then
    expect(result).toEqual({ value: 0, constantName: "IDLE" });
  });

  it("should return undefined once time crosses a gap (a point without a value)", () => {
    // Given
    const data = [
      buildDatum({ x: 1, value: "RUNNING" }),
      { x: 5, y: Number.NaN },
      buildDatum({ x: 10, value: "IDLE" }),
    ];

    // When
    const result = getValueAtTime(data, 7);

    // Then
    expect(result).toBeUndefined();
  });

  it("should skip undefined entries", () => {
    // Given
    const data = [
      buildDatum({ x: 1, value: "IDLE" }),
      undefined,
      buildDatum({ x: 10, value: "DONE" }),
    ];

    // When
    const result = getValueAtTime(data, 3);

    // Then
    expect(result).toEqual({
      value: "IDLE",
      constantName: undefined,
    });
  });
});
