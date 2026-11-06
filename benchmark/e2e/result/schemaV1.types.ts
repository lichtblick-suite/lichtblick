// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { TelemetrySample } from "../../../packages/suite-base/src/util/telemetry/types";

/** Full pool metric name (a `POOL_METRICS` value) -> samples (sorted). */
export type PoolSeries = Map<string, TelemetrySample[]>;

/** The series of one `HydratedSourcePool` instance (`<realm>/<poolId>`). */
export type PoolGroup = { realm: string; poolId: string; series: PoolSeries };

/** Per-poll totals of the host process samples sharing one `monotonicTs`. */
export type ProcessTick = { ws: number; hasWs: boolean; cpu: number; hasCpu: boolean };

/**
 * `strict` (default): a result as the current runner must write it. `lenient`: also accepts stored
 * results lacking fields added during v1 (`run.scenario`, the render calibration of
 * `run.environment`, `summary.kpis`); present fields are still checked.
 */
export type ResultValidationMode = "strict" | "lenient";

/**
 * `run.mode`: a normal scenario run (`scenario`) or a run of the telemetry overhead A/B
 * (`overhead`: steady window, no screenshots, `summary.steadyWindow`). Overhead runs are only
 * reachable through their `overhead-*.json` report; the scenario views (scorecard, overview, …)
 * exclude them (see `isOverheadRun`).
 */
export type RunModeV1 = "scenario" | "overhead";

/**
 * `run.environment.webBrowser` (web only): Playwright's default `chromium-headless-shell`, or the
 * full Chromium build in new headless mode (`chromium`), which provides
 * `performance.measureUserAgentSpecificMemory()` (the headless shell rejects every call).
 */
export type WebBrowserV1 = "chromium-headless-shell" | "chromium";
