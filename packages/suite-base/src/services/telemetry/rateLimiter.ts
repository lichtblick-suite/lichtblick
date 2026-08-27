// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type RateLimiterOptions = {
  /** Sustained rate, in tokens (events) allowed per minute. */
  ratePerMinute: number;
  /** Bucket capacity — the largest burst allowed before tokens must refill. */
  burst: number;
  /** Injectable clock, so tests don't depend on real timers. Defaults to `Date.now`. */
  now?: () => number;
};

/**
 * A minimal token-bucket rate limiter. Refill is computed lazily from elapsed time on each call
 * to `tryAcquire()` rather than from a running interval, so there is nothing to start or leak —
 * see docs/telemetry/interaction-heatmap-poc-plan.md WS-3, which uses this to bound
 * `AppEvent.UI_INTERACTION` volume without silently dropping events the way
 * `BatchLogRecordProcessor`'s queue does when it fills.
 */
export class RateLimiter {
  readonly #ratePerMs: number;
  readonly #capacity: number;
  readonly #now: () => number;
  #tokens: number;
  #lastRefillMs: number;

  public constructor(options: RateLimiterOptions) {
    this.#ratePerMs = options.ratePerMinute / 60_000;
    this.#capacity = options.burst;
    this.#now = options.now ?? Date.now;
    this.#tokens = options.burst;
    this.#lastRefillMs = this.#now();
  }

  /** Returns true and consumes one token if the bucket has capacity, false otherwise. */
  public tryAcquire(): boolean {
    this.#refill();
    if (this.#tokens < 1) {
      return false;
    }
    this.#tokens -= 1;
    return true;
  }

  #refill(): void {
    const now = this.#now();
    const elapsedMs = now - this.#lastRefillMs;
    if (elapsedMs <= 0) {
      return;
    }
    this.#tokens = Math.min(this.#capacity, this.#tokens + elapsedMs * this.#ratePerMs);
    this.#lastRefillMs = now;
  }
}
