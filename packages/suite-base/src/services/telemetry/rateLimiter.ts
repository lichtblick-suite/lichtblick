// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable filenames/match-exported */

export type TokenBucketOptions = {
  capacity: number;
  refillPerSecond: number;
  now?: () => number;
};

type ResolvedTokenBucketOptions = Omit<TokenBucketOptions, "now"> & {
  now: () => number;
};

class TokenBucket {
  readonly #capacity: number;
  readonly #refillPerSecond: number;
  readonly #now: () => number;
  #tokens: number;
  #lastRefillTime?: number;

  public constructor(options: TokenBucketOptions) {
    this.#capacity = Math.max(0, options.capacity);
    this.#refillPerSecond = Math.max(0, options.refillPerSecond);
    this.#now = options.now ?? Date.now;
    this.#tokens = this.#capacity;
  }

  public tryConsume(): boolean {
    this.#refill();
    if (this.#tokens < 1) {
      return false;
    }

    this.#tokens -= 1;
    return true;
  }

  public refund(): void {
    this.#tokens = Math.min(this.#capacity, this.#tokens + 1);
  }

  #refill(): void {
    const currentTime = this.#now();
    if (this.#lastRefillTime == undefined) {
      this.#lastRefillTime = currentTime;
      return;
    }

    const elapsedMilliseconds = currentTime - this.#lastRefillTime;
    if (elapsedMilliseconds <= 0) {
      this.#lastRefillTime = currentTime;
      return;
    }

    const refillAmount = (elapsedMilliseconds / 1000) * this.#refillPerSecond;
    this.#tokens = Math.min(this.#capacity, this.#tokens + refillAmount);
    this.#lastRefillTime = currentTime;
  }
}

export type RateLimiterConfig = {
  perKey: TokenBucketOptions;
  global: TokenBucketOptions;
};

export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  perKey: {
    capacity: 20,
    refillPerSecond: 1,
  },
  global: {
    capacity: 100,
    refillPerSecond: 5,
  },
};

export default class RateLimiter {
  readonly #globalBucket: TokenBucket;
  readonly #perKeyBucketOptions: ResolvedTokenBucketOptions;
  readonly #perKeyBuckets = new Map<string, TokenBucket>();

  public constructor(
    config: RateLimiterConfig = DEFAULT_RATE_LIMITER_CONFIG,
    now: () => number = Date.now,
  ) {
    this.#globalBucket = new TokenBucket({ ...config.global, now });
    this.#perKeyBucketOptions = { ...config.perKey, now };
  }

  public allow(key: string): boolean {
    try {
      if (!this.#globalBucket.tryConsume()) {
        return false;
      }

      const bucket = this.#getPerKeyBucket(key);
      if (bucket.tryConsume()) {
        return true;
      }

      this.#globalBucket.refund();
      return false;
    } catch {
      return true;
    }
  }

  #getPerKeyBucket(key: string): TokenBucket {
    let bucket = this.#perKeyBuckets.get(key);
    if (bucket == undefined) {
      bucket = new TokenBucket(this.#perKeyBucketOptions);
      this.#perKeyBuckets.set(key, bucket);
    }
    return bucket;
  }
}
