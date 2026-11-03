// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { parsePositiveNumberParam } from "./urlParams";

describe("parsePositiveNumberParam", () => {
  it.each([
    ["12.5", 12.5],
    ["10000", 10_000],
    [" 3 ", 3],
  ])("should parse the positive value %p", (raw, expected) => {
    // Given
    const url = new URL(`http://localhost/?x=${encodeURIComponent(raw)}`);

    // When
    const value = parsePositiveNumberParam(url, "x");

    // Then
    expect(value).toBe(expected);
  });

  it.each([
    "",
    "  ",
    "0",
    "-5",
    "abc",
    "Infinity",
    "NaN",
  ])("should return undefined for the invalid value %p", (raw) => {
    // Given
    const url = new URL(`http://localhost/?x=${encodeURIComponent(raw)}`);

    // When
    const value = parsePositiveNumberParam(url, "x");

    // Then
    expect(value).toBeUndefined();
  });

  it("should return undefined when the param is absent", () => {
    // Given
    const url = new URL("http://localhost/?y=5");

    // When
    const value = parsePositiveNumberParam(url, "x");

    // Then
    expect(value).toBeUndefined();
  });
});
