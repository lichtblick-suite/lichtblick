// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Free of runtime imports: also read by the Playwright runner (`benchmark/e2e`).

import type { TelemetryUnit } from "@lichtblick/suite-base/util/telemetry";

import type { LichtblickTelemetryWindowKey, SelfCostMetricKey } from "./types";

/** `?telemetry=off` disables benchmark telemetry. */
export const TELEMETRY_QUERY_PARAM = "telemetry";
export const TELEMETRY_OFF_VALUE = "off";

/**
 * `?telemetry.lateFrameThresholdMs=<ms>` overrides the renderer late-frame threshold (default
 * `LATE_FRAME_THRESHOLD_MS`). The benchmark runner sets it from the measured display refresh rate
 * so "late" means 1.5 real frame intervals on any display.
 */
export const LATE_FRAME_THRESHOLD_QUERY_PARAM = "telemetry.lateFrameThresholdMs";

/** Realm of the main-thread (renderer) sink. Worker realms are bridged in as `worker:<n>`. */
export const RENDERER_REALM = "renderer";

export const TELEMETRY_WINDOW_KEY: LichtblickTelemetryWindowKey = "lichtblickTelemetry";

/**
 * Self-cost counters of the benchmark telemetry (cumulative, scope "renderer", no labels). Time is
 * accumulated in plain numeric fields and published once per renderer collector tick (1 Hz).
 */
export const TELEMETRY_SELF_COST_METRICS = {
  /** counter, ms: inside the renderer collector 1 Hz tick (heap sample, fps publish, UA scheduling). */
  collectorsMs: "telemetry.self.timeMs.collectors",
  /** counter, ms: inside the `FrameCollector` animation frame callback. */
  framesMs: "telemetry.self.timeMs.frames",
  /** counter, ms: inside the `LongTaskCollector` observer callback. */
  longTasksMs: "telemetry.self.timeMs.longTasks",
  /** counter, ms: inside the renderer sink's periodic (1 Hz) publish. */
  sinkPublishMs: "telemetry.self.timeMs.sinkPublish",
  /** counter, ms: inside `window.lichtblickTelemetry.drain()`. */
  drainMs: "telemetry.self.timeMs.drain",
  /** counter, ms: synchronous part of `performance.measureUserAgentSpecificMemory()`. */
  uaMemoryMs: "telemetry.self.timeMs.uaMemory",
  /** counter, count: `measureUserAgentSpecificMemory()` calls. */
  uaMemoryCalls: "telemetry.self.uaMemory.calls",
  /** counter, ms: summed call -> resolve latency of resolved `measureUserAgentSpecificMemory()` calls. */
  uaMemoryResolveMs: "telemetry.self.uaMemory.resolveMs",
  /** counter, count: resolved `measureUserAgentSpecificMemory()` calls (denominator of `resolveMs`). */
  uaMemoryResolved: "telemetry.self.uaMemory.resolved",
  /** counter, count: rejected `measureUserAgentSpecificMemory()` calls. */
  uaMemoryFailures: "telemetry.self.uaMemory.failures",
} as const;

/** Unit of each `TELEMETRY_SELF_COST_METRICS` counter. */
export const TELEMETRY_SELF_COST_UNITS: Readonly<Record<SelfCostMetricKey, TelemetryUnit>> = {
  collectorsMs: "ms",
  framesMs: "ms",
  longTasksMs: "ms",
  sinkPublishMs: "ms",
  drainMs: "ms",
  uaMemoryMs: "ms",
  uaMemoryCalls: "count",
  uaMemoryResolveMs: "ms",
  uaMemoryResolved: "count",
  uaMemoryFailures: "count",
};
