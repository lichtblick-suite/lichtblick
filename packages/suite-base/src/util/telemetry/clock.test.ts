// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BasicBuilder } from "@lichtblick/test-builders";

import { monotonicNow } from "./clock";

describe("monotonicNow", () => {
  it("returns performance.timeOrigin + performance.now()", () => {
    // Given
    const timeOrigin = BasicBuilder.number({ min: 1_000_000, max: 2_000_000 });
    const elapsed = BasicBuilder.float(0, 10_000);
    jest.spyOn(globalThis.performance, "timeOrigin", "get").mockReturnValue(timeOrigin);
    jest.spyOn(globalThis.performance, "now").mockReturnValue(elapsed);

    // When
    const result = monotonicNow();

    // Then
    expect(result).toBe(timeOrigin + elapsed);
  });

  it("is non-decreasing between consecutive calls", () => {
    // Given
    const first = monotonicNow();

    // When
    const second = monotonicNow();

    // Then
    expect(second).toBeGreaterThanOrEqual(first);
  });
});
