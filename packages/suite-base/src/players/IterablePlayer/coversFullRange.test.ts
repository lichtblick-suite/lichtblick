// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { FULLY_PRELOADED_EPSILON } from "./constants";
import { coversFullRange } from "./coversFullRange";

describe("coversFullRange", () => {
  it("should return false when no ranges have been reported", () => {
    // Given / When
    const result = coversFullRange(undefined);

    // Then
    expect(result).toBe(false);
  });

  it("should return false for an empty list of ranges", () => {
    // Given / When
    const result = coversFullRange([]);

    // Then
    expect(result).toBe(false);
  });

  it.each([
    ["a single full range", [{ start: 0, end: 1 }]],
    [
      "adjacent ranges summing to the full range",
      [
        { start: 0, end: 0.25 },
        { start: 0.25, end: 1 },
      ],
    ],
    [
      "a range short of the end by less than the epsilon",
      [{ start: 0, end: 1 - FULLY_PRELOADED_EPSILON / 2 }],
    ],
  ])("should return true for %s", (_label, ranges) => {
    // Given / When
    const result = coversFullRange(ranges);

    // Then
    expect(result).toBe(true);
  });

  it.each([
    ["a partial range", [{ start: 0, end: 0.5 }]],
    [
      "ranges with a gap",
      [
        { start: 0, end: 0.4 },
        { start: 0.6, end: 1 },
      ],
    ],
    [
      "a range short of the end by more than the epsilon",
      [{ start: 0, end: 1 - 10 * FULLY_PRELOADED_EPSILON }],
    ],
  ])("should return false for %s", (_label, ranges) => {
    // Given / When
    const result = coversFullRange(ranges);

    // Then
    expect(result).toBe(false);
  });
});
