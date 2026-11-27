// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { memoryMetricName, toLowerCamelCase } from "./memoryMetricName";

describe("toLowerCamelCase", () => {
  it.each([
    ["Buffered messages", "bufferedMessages"],
    ["Preloaded messages", "preloadedMessages"],
    ["bufferedMessages", "bufferedmessages"],
    ["MCAP read-ahead", "mcapReadAhead"],
    ["  leading/trailing__separators!! ", "leadingTrailingSeparators"],
    ["cache 2 bytes", "cache2Bytes"],
    ["single", "single"],
  ])("should convert %p to %p", (label, expected) => {
    // Given / When
    const result = toLowerCamelCase(label);

    // Then
    expect(result).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "-_/ ",
    "äöü",
  ])("should return an empty string for %p, which has no ASCII alphanumerics", (label) => {
    // Given / When
    const result = toLowerCamelCase(label);

    // Then
    expect(result).toBe("");
  });
});

describe("memoryMetricName", () => {
  it("should prefix the lowerCamelCase key with pipeline.memory.", () => {
    // Given
    const keys = ["Buffered messages", "Preloaded messages"];

    // When
    const metrics = keys.map(memoryMetricName);

    // Then
    expect(metrics).toEqual([
      "pipeline.memory.bufferedMessages",
      "pipeline.memory.preloadedMessages",
    ]);
  });

  it("should return the same cached string for repeated lookups of a key", () => {
    // Given
    const key = "Some cached key";

    // When
    const first = memoryMetricName(key);
    const second = memoryMetricName(key);

    // Then
    expect(first).toBe("pipeline.memory.someCachedKey");
    expect(second).toBe(first);
  });

  it("should return undefined for a key without alphanumerics, also on repeated lookups", () => {
    // Given
    const key = " -- ";

    // When
    const first = memoryMetricName(key);
    const second = memoryMetricName(key);

    // Then
    expect(first).toBeUndefined();
    expect(second).toBeUndefined();
  });
});
