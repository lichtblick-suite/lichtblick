// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

describe("loadOtelAnalytics", () => {
  const importOtelAnalytics = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    importOtelAnalytics.mockReset();
  });

  it("resolves the OtelAnalytics implementation and memoizes the dynamic import", async () => {
    // Given
    jest.doMock("@lichtblick/suite-base/services/telemetry/OtelAnalytics", () => {
      importOtelAnalytics();
      return { __esModule: true, default: function MockOtelAnalytics() {} };
    });
    const loadOtelAnalytics = (await import("./loadOtelAnalytics")).default;

    // When
    const first = await loadOtelAnalytics();
    const second = await loadOtelAnalytics();

    // Then
    expect(first).toBe(second);
    expect(importOtelAnalytics).toHaveBeenCalledTimes(1);
  });

  it("clears the cache and allows retrying after a failed import", async () => {
    // Given
    let shouldFail = true;
    jest.doMock("@lichtblick/suite-base/services/telemetry/OtelAnalytics", () => {
      importOtelAnalytics();
      if (shouldFail) {
        throw new Error("network error");
      }
      return { __esModule: true, default: function MockOtelAnalytics() {} };
    });
    const loadOtelAnalytics = (await import("./loadOtelAnalytics")).default;

    // When
    await expect(loadOtelAnalytics()).rejects.toThrow("network error");
    shouldFail = false;
    const resolved = await loadOtelAnalytics();

    // Then
    expect(resolved).toBeDefined();
    expect(importOtelAnalytics).toHaveBeenCalledTimes(2);
  });
});
