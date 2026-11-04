// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Type-only module: shared between the benchmark page (which installs the API) and the Playwright
// runner (`benchmark/e2e`, which calls it through `page.evaluate`). Keep it free of runtime imports.

import type { TelemetryBatch } from "@lichtblick/suite-base/util/telemetry";

import type { RendererCollectorsEnv } from "./collectors/types";
import type { TELEMETRY_SELF_COST_METRICS } from "./constants";

/** Key of a self-cost counter (see `TELEMETRY_SELF_COST_METRICS`). */
export type SelfCostMetricKey = keyof typeof TELEMETRY_SELF_COST_METRICS;

/**
 * Telemetry API the benchmark page exposes as `window.lichtblickTelemetry` for the runner.
 *
 * Always installed by the benchmark entry point, also when telemetry is turned off with
 * `?telemetry=off`; in that case `isEnabled()` is false and `drain()` returns an empty batch.
 */
export interface LichtblickTelemetryWindowApi {
  /** True while the renderer telemetry sink records (false when off or after page teardown). */
  isEnabled(): boolean;
  /** Current `monotonicNow()` of the page (epoch ms, same clock as `TelemetryRecord.monotonicTs`). */
  now(): number;
  /**
   * Removes and returns up to `maxRecords` of the oldest buffered records (all realms ingested into
   * the renderer sink, including workers) plus the drop count since the previous drain.
   */
  drain(maxRecords?: number): TelemetryBatch;
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
  /** Emits the `app.ready` instant event (scope "app"). Only the first call has an effect. */
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
