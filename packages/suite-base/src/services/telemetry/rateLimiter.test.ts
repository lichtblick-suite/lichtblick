// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RateLimiter } from "./rateLimiter";

/** Fake clock so refill math can be tested without real timers. */
function makeClock(startMs = 0) {
  let now = startMs;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("RateLimiter", () => {
  it("allows exactly `burst` acquisitions with no elapsed time, then rejects", () => {
    // Given: a bucket that starts full
    const clock = makeClock();
    const limiter = new RateLimiter({ ratePerMinute: 60, burst: 3, now: clock.now });

    // When/Then: the first 3 succeed, the 4th (no time elapsed) does not
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
  });

  it("refills tokens proportionally to elapsed time, capped at burst", () => {
    // Given: a bucket drained to zero
    const clock = makeClock();
    const limiter = new RateLimiter({ ratePerMinute: 60, burst: 2, now: clock.now });
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);

    // When: half the time needed for one token elapses (60/min == 1 token/sec)
    clock.advance(500);

    // Then: still not enough for a full token
    expect(limiter.tryAcquire()).toBe(false);

    // When: the rest of the second elapses
    clock.advance(500);

    // Then: exactly one token is available, not two
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
  });

  it("never accumulates more than `burst` tokens even after a long idle period", () => {
    // Given: a bucket that starts full and is left untouched for a long time
    const clock = makeClock();
    const limiter = new RateLimiter({ ratePerMinute: 60, burst: 3, now: clock.now });

    // When: an hour passes with no acquisitions
    clock.advance(60 * 60_000);

    // Then: only `burst` tokens are available, not thousands
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(true);
    expect(limiter.tryAcquire()).toBe(false);
  });

  it("bounds a large burst to the configured capacity, rejecting the rest", () => {
    // Given: the interaction-capture defaults' shape (a ceiling far below a click storm)
    const clock = makeClock();
    const limiter = new RateLimiter({ ratePerMinute: 120, burst: 20, now: clock.now });

    // When: 1000 synthetic clicks arrive instantaneously (see useInteractionCapture.test.ts for
    // the end-to-end version of this scenario against the real hook)
    const results = Array.from({ length: 1000 }, () => limiter.tryAcquire());

    // Then: exactly `burst` are allowed and the remainder are rejected, never silently truncated
    expect(results.filter(Boolean)).toHaveLength(20);
    expect(results.filter((allowed) => !allowed)).toHaveLength(980);
  });
});
