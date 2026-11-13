// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Type-only module: shared between the benchmark page (which installs the API) and the Playwright
// runner (`benchmark/e2e`, which calls it through `page.evaluate`). Keep it free of runtime imports.

import type {
  BufferedTelemetrySinkOptions,
  TelemetryBatch,
} from "@lichtblick/suite-base/util/telemetry";

import type { RendererCollectorsEnv, UaMemoryCollectorState } from "./collectors/types";
import type { TELEMETRY_SELF_COST_METRICS } from "./constants";

/** Key of a self-cost counter (see `TELEMETRY_SELF_COST_METRICS`). */
export type SelfCostMetricKey = keyof typeof TELEMETRY_SELF_COST_METRICS;

/** Which optional renderer collectors run (`collectorsState()`). */
export type TelemetryCollectorsState = {
  /**
   * `disabled`: telemetry is off (`?telemetry=off`); `off`: disabled with `?telemetry.uaMemory=off`;
   * `unsupported`: page not cross-origin isolated, API missing, or the browser rejected a call with
   * `SecurityError` (API not provided, e.g. `chromium-headless-shell`); `on`: measuring.
   */
  readonly uaMemory: UaMemoryCollectorState | "disabled";
};

/** Mean cost per call (ns) of the sink's recording primitives (`measureEmitCost()`). */
export type EmitCostResult = {
  readonly gaugeNs: number;
  readonly counterNs: number;
  readonly eventNs: number;
};

/** Argument of `setTelemetryActive()`. */
export type TelemetryToggleRequest = {
  /** True records (telemetry on), false pauses recording (telemetry off). */
  readonly active: boolean;
};

/** Result of `setTelemetryActive()`. */
export type TelemetryToggleResult = {
  /** Whether renderer telemetry records after the call (always false when installed off). */
  readonly active: boolean;
  /** Page `monotonicNow()` right after the switch (epoch ms, same clock as `now()`). */
  readonly atMs: number;
  /**
   * `measureUserAgentSpecificMemory()` calls so far (cumulative; 0 when the collector is off or
   * telemetry is installed off). The difference between two results counts the calls in between.
   */
  readonly uaCalls: number;
};

/** Argument of `setFrameProbeActive()`. */
export type FrameProbeToggleRequest = {
  /** True runs the bare frame loop, false stops it. */
  readonly active: boolean;
};

/** Result of `setFrameProbeActive()`. */
export type FrameProbeToggleResult = {
  /** Whether the frame loop runs after the call (false without `requestAnimationFrame`). */
  readonly active: boolean;
  /** Page `monotonicNow()` right after the switch (epoch ms, same clock as `now()`). */
  readonly atMs: number;
};

export type MeasureEmitCostOptions = {
  /** Options of the throwaway sink (same as the live sink, without `onEvent`/timers). */
  readonly sinkOptions: BufferedTelemetrySinkOptions;
  /** Clock timing the loops (ms). */
  readonly now: () => number;
  /** Timed calls per primitive; invalid / absent -> `EMIT_COST_DEFAULT_ITERATIONS`. */
  readonly iterations?: number;
};

/**
 * Telemetry API the benchmark page exposes as `window.lichtblickTelemetry` for the runner.
 *
 * Always installed by the benchmark entry point, also when telemetry is turned off with
 * `?telemetry=off` (overhead A/B runs); in that case `isEnabled()` is false and `drain()` returns
 * an empty batch.
 */
export interface LichtblickTelemetryWindowApi {
  /** True while the renderer telemetry sink records (false when off or after page teardown). */
  isEnabled(): boolean;
  /** Current `monotonicNow()` of the page (epoch ms, same clock as `TelemetryRecord.monotonicTs`). */
  now(): number;
  /**
   * Removes and returns up to `maxRecords` of the oldest buffered records (all realms ingested into
   * the renderer sink, including workers) plus the renderer sink's own drop count since the
   * previous drain (worker drops are reported in `telemetry.ingestedDroppedRecords{realm}`).
   */
  drain(maxRecords?: number): TelemetryBatch;
  /** Which optional renderer collectors run; `uaMemory: "disabled"` when telemetry is off. */
  collectorsState(): TelemetryCollectorsState;
  /**
   * Micro-benchmark of `gauge` / `counter` / `event` on a throwaway sink configured like the live
   * one (the live sink is untouched): mean ns per call over `iterations` calls each (default
   * `EMIT_COST_DEFAULT_ITERATIONS`). Blocks the main thread while it runs; call it after the
   * measured window. All zeros when telemetry is off.
   */
  measureEmitCost(iterations?: number): EmitCostResult;
  /**
   * In-process overhead A/B switch (only meaningful when installed enabled; otherwise a no-op that
   * returns `active: false`). Idempotent.
   * - `{ active: false }`: pauses the renderer collectors (tick, frame recording, long-task observer,
   *   UA-memory probe) after publishing their partial window; the frame collector's RAF loop keeps
   *   running (benchmark harness, in both arms), flushes the sink, gates the sink (cached references
   *   become no-ops), stops its publish timer and resets the realm sink to the no-op.
   * - `{ active: true }`: reinstalls the sink as the realm sink, ungates it, restarts its publish timer and
   *   resumes the collectors.
   * Buffered records stay drainable in both states. Worker-realm sinks are not switched: bridged
   * worker batches are discarded while off.
   */
  setTelemetryActive(request: TelemetryToggleRequest): TelemetryToggleResult;
  /**
   * Benchmark FPS probe A/B (installed with `?telemetry=off` only; absent otherwise): starts or
   * stops a bare `requestAnimationFrame` loop (`FrameLoop` with a no-op callback, the frame
   * collector's loop without the collector). Measures the harness cost of the frame loop with
   * telemetry off in both arms. The loop is stopped until the first `{ active: true }`. Idempotent.
   */
  setFrameProbeActive?(request: FrameProbeToggleRequest): FrameProbeToggleResult;
}

/** Property name of the API on `window`. */
export type LichtblickTelemetryWindowKey = "lichtblickTelemetry";

/** Shape of a `window` carrying the API; use with `page.evaluate` in the runner. */
export type LichtblickTelemetryWindow = {
  [K in LichtblickTelemetryWindowKey]?: LichtblickTelemetryWindowApi;
};

/** Returned by `installBenchmarkTelemetry` when telemetry is enabled. */
export interface BenchmarkTelemetryHandle {
  // Function-typed properties (not methods): safe to pass around unbound, e.g. as a React prop.
  /**
   * Emits the `app.ready` instant event (scope "app"). Only the first call has an effect. It marks
   * the benchmark root's first commit (the earliest common origin of synthetic runs), not a usable
   * app: `layout.applied`, `panel.firstRender` and `datasource.firstMessage` come later.
   */
  readonly markAppReady: () => void;
  /** Stops all renderer collectors and disposes the sink (records remain drainable). Idempotent. */
  readonly dispose: () => void;
}

/** The parts of `window` the installer touches. */
export type TelemetryInstallTarget = LichtblickTelemetryWindow & {
  addEventListener(type: "pagehide" | "beforeunload", listener: () => void): void;
  removeEventListener(type: "pagehide" | "beforeunload", listener: () => void): void;
};

export type InstallBenchmarkTelemetryOptions = {
  /** Defaults to `window`. */
  target?: TelemetryInstallTarget;
  /** Defaults to `getDefaultRendererCollectorsEnv()`. */
  collectorsEnv?: RendererCollectorsEnv;
};
