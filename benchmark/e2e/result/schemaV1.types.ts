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
 * `run.mode`: always `scenario` (a normal scenario run). Kept as a required discriminator so other
 * run kinds can be added without a schema version bump.
 */
export type RunModeV1 = "scenario";

/**
 * `run.environment.webBrowser` (web only): Playwright's default `chromium-headless-shell`, or the
 * full Chromium build in new headless mode (`chromium`), which provides
 * `performance.measureUserAgentSpecificMemory()` (the headless shell rejects every call).
 */
export type WebBrowserV1 = "chromium-headless-shell" | "chromium";

/**
 * `run.environment.hostCpuSource`: where the host collector read process CPU.
 * - `cdp`: CDP `SystemInfo.getProcessInfo` cumulative CPU time, as deltas between polls (web);
 * - `app-metrics`: Electron `app.getAppMetrics()` `percentCPUUsage` since the previous poll;
 * - `ps`: the web collector fell back to the `ps` process tree at some point during the run (it
 *   stays there once CDP failed). `pcpu` is ps' own average (lifetime on Linux, decaying on macOS),
 *   not CPU over the poll interval, so it is not recorded and the run's CPU summary and KPIs are
 *   left empty, also for the polls before the fallback, so CDP deltas and ps values never mix.
 *   Per-poll `process.cpuPercent` samples taken through CDP before the fallback remain in `samples`.
 */
export type HostCpuSourceV1 = "cdp" | "app-metrics" | "ps";
