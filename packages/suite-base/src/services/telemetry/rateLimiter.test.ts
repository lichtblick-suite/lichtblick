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

  it("refunds the global token when an error occurs after it was consumed", () => {
    // Given
    let shouldThrow = false;
    let clockCallsSinceThrow = 0;
    const rateLimiter = new RateLimiter(
      {
        perKey: { capacity: 1, refillPerSecond: 0 },
        global: { capacity: 1, refillPerSecond: 0 },
      },
      () => {
        clockCallsSinceThrow += 1;
        // Throw only on the second clock read (the per-key bucket check) of the
        // first `allow()` call, simulating a failure after the global token is consumed.
        if (shouldThrow && clockCallsSinceThrow === 2) {
          throw new Error("per-key bucket failure");
        }
        return 0;
      },
    );
    shouldThrow = true;

    // When
    const failedOpen = rateLimiter.allow("app.init");
    shouldThrow = false;
    clockCallsSinceThrow = 0;
    const afterFailure = rateLimiter.allow("app.init");

    // Then
    expect(failedOpen).toBe(true);
    expect(afterFailure).toBe(true);
  });

  it("evicts the least-recently-used per-key bucket once maxKeys is exceeded", () => {
    // Given
    const currentTime = 0;
    const rateLimiter = new RateLimiter(
      {
        perKey: { capacity: 1, refillPerSecond: 0 },
        global: { capacity: 10, refillPerSecond: 0 },
        maxKeys: 2,
      },
      () => currentTime,
    );

    // When
    rateLimiter.allow("alpha"); // Map: [alpha]
    rateLimiter.allow("beta"); // Map: [alpha, beta]
    // Re-access "alpha" (even though its token is already spent) to mark it as
    // more-recently-used than "beta", moving it to the end of the eviction order.
    rateLimiter.allow("alpha"); // Map: [beta, alpha]
    // Adding a third key exceeds maxKeys, so the least-recently-used bucket ("beta")
    // is evicted rather than "alpha".
    rateLimiter.allow("gamma"); // Map: [alpha, gamma]
    // "alpha" should still be present (and still out of tokens), proving it survived
    // eviction because it was more recently used than "beta".
    const alphaStillPresent = rateLimiter.allow("alpha");

    // Then
    expect(alphaStillPresent).toBe(false);
  });
});
