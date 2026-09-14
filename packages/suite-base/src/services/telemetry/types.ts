// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type RateLimiter from "@lichtblick/suite-base/services/telemetry/rateLimiter";

export interface IdentityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type OtelAnalyticsOptions = {
  endpoint: string;
  version: string;
  platform: "web" | "desktop";
  rateLimiter?: RateLimiter;
};

export type TokenBucketOptions = {
  capacity: number;
  refillPerSecond: number;
  now?: () => number;
};

export type RateLimiterConfig = {
  perKey: TokenBucketOptions;
  global: TokenBucketOptions;
  /**
   * Maximum number of distinct per-key buckets to retain. `allow()` is expected to be called
   * with keys from a bounded set (e.g. `AppEvent` values). If more distinct keys than this are
   * seen, the least-recently-used bucket is evicted to bound memory usage.
   */
  maxKeys?: number;
};
