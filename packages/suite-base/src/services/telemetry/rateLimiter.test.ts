// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import RateLimiter from "./rateLimiter";

describe("RateLimiter", () => {
  it("allows up to the configured capacity for a single key before blocking", () => {
    // Given
    const currentTime = 0;
    const rateLimiter = new RateLimiter(
      {
        perKey: { capacity: 2, refillPerSecond: 1 },
        global: { capacity: 10, refillPerSecond: 10 },
      },
      () => currentTime,
    );

    // When
    const first = rateLimiter.allow("panel.add");
    const second = rateLimiter.allow("panel.add");
    const third = rateLimiter.allow("panel.add");

    // Then
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(third).toBe(false);
  });

  it("allows requests again after enough time passes for a refill", () => {
    // Given
    let currentTime = 0;
    const rateLimiter = new RateLimiter(
      {
        perKey: { capacity: 1, refillPerSecond: 1 },
        global: { capacity: 10, refillPerSecond: 10 },
      },
      () => currentTime,
    );

    // When
    const first = rateLimiter.allow("layout.update");
    const blocked = rateLimiter.allow("layout.update");
    currentTime += 1000;
    const afterRefill = rateLimiter.allow("layout.update");

    // Then
    expect(first).toBe(true);
    expect(blocked).toBe(false);
    expect(afterRefill).toBe(true);
  });

  it("keeps per-key buckets independent across different keys", () => {
    // Given
    const currentTime = 0;
    const rateLimiter = new RateLimiter(
      {
        perKey: { capacity: 1, refillPerSecond: 0 },
        global: { capacity: 10, refillPerSecond: 0 },
      },
      () => currentTime,
    );

    // When
    const firstAlpha = rateLimiter.allow("alpha");
    const secondAlpha = rateLimiter.allow("alpha");
    const firstBeta = rateLimiter.allow("beta");

    // Then
    expect(firstAlpha).toBe(true);
    expect(secondAlpha).toBe(false);
    expect(firstBeta).toBe(true);
  });

  it("shares the global bucket across different keys", () => {
    // Given
    const currentTime = 0;
    const rateLimiter = new RateLimiter(
      {
        perKey: { capacity: 10, refillPerSecond: 0 },
        global: { capacity: 2, refillPerSecond: 0 },
      },
      () => currentTime,
    );

    // When
    const first = rateLimiter.allow("alpha");
    const second = rateLimiter.allow("beta");
    const third = rateLimiter.allow("gamma");

    // Then
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(third).toBe(false);
  });

  it("fails open when the injected clock throws", () => {
    // Given
    const rateLimiter = new RateLimiter(
      {
        perKey: { capacity: 1, refillPerSecond: 1 },
        global: { capacity: 1, refillPerSecond: 1 },
      },
      () => {
        throw new Error("clock failure");
      },
    );
    let result = false;

    // When
    expect(() => {
      result = rateLimiter.allow("app.init");
    }).not.toThrow();

    // Then
    expect(result).toBe(true);
  });
});
