// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Free of DOM/Playwright/Node imports (compiled by the root tsconfig too). The page-side shapes
// (`benchmark/src/telemetry/types.ts` `TelemetryCollectorsState`, `EmitCostResult`) are mirrored,
// not imported: that module needs the `@lichtblick/suite-base` alias. `runner/overheadPage.ts`
// assigns the page values to these types, so the e2e typecheck catches drift.

import type { TelemetryRecord } from "../../../packages/suite-base/src/util/telemetry/types";

/** Page telemetry components that report their own main-thread time (`TELEMETRY_SELF_TIME_METRICS`). */
export type TelemetrySelfComponent =
  | "collectors"
  | "frames"
  | "longTasks"
  | "sinkPublish"
  | "drain"
  | "uaMemory";

/**
 * State of the page's optional collectors (`window.lichtblickTelemetry.collectorsState()`), stored
 * as `run.environment.collectors`. `uaMemory`: the UA-specific memory probe
 * (`performance.measureUserAgentSpecificMemory`) is running (`on`), turned off with
 * `?telemetry.uaMemory=off` (`off`), not available in this browser/context (`unsupported`; also
 * after a call was rejected with `SecurityError`, read at the end of the run), or telemetry itself
 * is off (`disabled`).
 */
export type CollectorsStateV1 = { uaMemory: "on" | "off" | "unsupported" | "disabled" };

/**
 * Per-record emit cost measured by the page on a throwaway sink after the run
 * (`window.lichtblickTelemetry.measureEmitCost()`), nanoseconds per call.
 */
export type EmitCostNsV1 = { gaugeNs: number; counterNs: number; eventNs: number };

/**
 * `summary.telemetrySelf` (overhead A/B runs with telemetry on): what the page telemetry itself costs
 * on the main thread over the steady window (`summary.steadyWindow`). A lower bound: GC and memory
 * pressure caused by the records are not included.
 */
export type TelemetrySelfSummaryV1 = {
  /** Length of the steady window the rates are computed over, seconds. */
  windowSec: number;
  /** Main-thread ms per second from the cumulative `telemetry.self.timeMs.*` counters. */
  msPerSec: { total: number; byComponent: Partial<Record<TelemetrySelfComponent, number>> };
  /** Page records (samples + events, all realms) stamped inside the steady window, per second. */
  recordsPerSec: number;
  /** `telemetry.self.uaMemory.calls` over the whole run (not only the steady window). */
  uaCalls: number;
  /** Resolved calls over the whole run (omitted for page builds without the counter). */
  uaResolved?: number;
  /**
   * Rejected calls over the whole run (omitted for page builds without the counter). In a browser
   * that does not provide the API (e.g. `chromium-headless-shell`) the first call is rejected with
   * `SecurityError` and the probe stops (`run.environment.collectors.uaMemory: "unsupported"`).
   */
  uaFailures?: number;
  /**
   * Mean call → resolve latency of the RESOLVED calls over the whole run, ms
   * (`telemetry.self.uaMemory.resolveMs / resolved`). Wall-clock latency, not main-thread time: the
   * browser resolves with its next GC (often ~10 s+). Omitted without resolved calls.
   */
  uaResolveMsMean?: number;
  /** Omitted when the page could not measure it. */
  emitCostNs?: EmitCostNsV1;
  /** Emit cost per record, weighted by the window's mix of gauges, counters and events. */
  meanEmitNs?: number;
  /** `recordsPerSec × meanEmitNs / 1e6`: estimated main-thread ms/s spent emitting records. */
  estimatedEmitMsPerSec?: number;
  /** `(msPerSec.total + estimatedEmitMsPerSec) / 1000`: share of one core. */
  fractionOfCore: number;
};

export type TelemetrySelfInput = {
  /** Every record drained from the page (any realm). */
  pageRecords: readonly TelemetryRecord[];
  /** Steady window on the page clock. */
  startMonotonicTs: number;
  endMonotonicTs: number;
  emitCostNs?: EmitCostNsV1;
};

/** Records stamped inside a window, by kind (samples split by metric type). */
export type TelemetryRecordMix = { gauges: number; counters: number; events: number };
