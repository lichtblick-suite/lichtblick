// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import IAnalytics from "./IAnalytics";

/** Closed set of metric names. Keep this list short — new metrics must be reviewed for cardinality (see plan section 6). */
export type MetricName =
  | "lichtblick.memory.heap.used"
  | "lichtblick.memory.process.rss"
  | "lichtblick.session.duration";

/**
 * Attribute values sent alongside events/metrics. Never put high-cardinality or PII values here
 * (file paths, topic names, layout names, device ids, error text) — see plan section 6.
 */
export type Attributes = Record<string, string | number | boolean | undefined>;

/**
 * Extends `IAnalytics` with numeric metric recording. `logEvent` is unchanged so none of the
 * existing ~40 call sites need to change when a provider implements this instead of `IAnalytics`.
 */
export default interface ITelemetry extends IAnalytics {
  /** Records an instantaneous value (gauge), e.g. current heap size. */
  recordValue(metric: MetricName, value: number, attrs?: Attributes): void;

  /** Records a duration in milliseconds (histogram), e.g. session length. */
  recordDuration(metric: MetricName, ms: number, attrs?: Attributes): void;

  /**
   * Increments a bare Prometheus counter by 1, with sanitized attributes. Unlike `logEvent`, this
   * never emits a log line — use it for counts that can occur far more often than it is safe to
   * write to the log tier (e.g. the interaction rate limiter's drop count, see
   * docs/telemetry/interaction-heatmap-poc-plan.md WS-3). `name` is a free string rather than
   * `MetricName` because it mirrors the AppEvent-driven counters in eventRouting.ts, which are
   * also not part of that closed union.
   */
  incrementCounter(name: string, attrs?: Attributes): void;

  /** Flushes any buffered metrics/events. Must be safe to call multiple times. */
  flush(): Promise<void>;
}
