// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Free of DOM/Playwright/Node imports (compiled by the root tsconfig too).

import type { HostProcessSample } from "./schemaV1";

/**
 * One reading of the runner-injected main-thread probe (`window.__benchmarkMainThreadProbe.read()`,
 * see `runner/mainThreadProbe.ts`), installed identically with telemetry off and on.
 */
export type MainThreadProbeReading = {
  /** Summed `longtask` entry durations since the document started, ms. */
  longTaskMs: number;
  /** `requestAnimationFrame` callbacks since the document started. */
  frames: number;
  /** `performance.now()` at the reading, ms. */
  nowMs: number;
};

/** Main-thread rates between two probe readings. */
export type MainThreadRatesV1 = {
  /** Long-task milliseconds per second (time the main thread was blocked by tasks > 50 ms). */
  longTaskBlockedMsPerSec: number;
  /** Animation frames per second. */
  fps: number;
};

/**
 * `summary.steadyWindow`: host process statistics over the fixed-schedule steady window of an
 * overhead A/B run (`runScenario` with `measurement.mode = "steady"`). Absent in normal runs.
 *
 * The window starts after `warmupMs` with a priming poll (its CPU covers the warm-up, so it is not
 * a steady poll), then `requestedPolls` polls at `t0 + i × sampleIntervalMs`; each steady poll's
 * CPU therefore covers exactly one interval inside the window.
 */
export type SteadyWindowSummaryV1 = {
  warmupMs: number;
  requestedPolls: number;
  /** Steady polls that reported host samples. */
  polls: number;
  /** Polls that ended after the next poll's slot (slow host collection). */
  overruns: number;
  /** `polls < requestedPolls` or `overruns > 0`: excluded from A/B pairs. */
  windowMismatch: boolean;
  /**
   * Longest host poll of the window (priming and steady polls), wall-clock ms; an overrun needs one
   * above the interval. Absent in results recorded before it was reported.
   */
  maxPollLatencyMs?: number;
  /**
   * Round trip of the Node → page clock sync that stamped the polls (the stamps are exact to ± half
   * of it). Absent in results recorded before polls were stamped without a page call.
   */
  clockSyncRttMs?: number;
  /** Page clock at the priming poll and at the last steady poll. */
  startMonotonicTs: number;
  endMonotonicTs: number;
  medianTotalCpuPercent: number;
  meanTotalCpuPercent: number;
  meanTotalWorkingSetBytes: number;
  peakTotalWorkingSetBytes: number;
  /** Mean per-poll working set per process type (a type absent in a poll counts 0 there). */
  meanWorkingSetBytesByType: Record<string, number>;
  /** Highest number of processes per type seen in one steady poll. */
  processSet: Record<string, number>;
  /** Main-thread probe rates over the window (absent when the probe could not be read). */
  mainThread?: MainThreadRatesV1;
};

export type SteadyWindowInput = {
  hostSamples: readonly HostProcessSample[];
  /** Page clock of each steady poll (the priming poll excluded). */
  pollTimestamps: readonly number[];
  requestedPolls: number;
  overruns: number;
  maxPollLatencyMs?: number;
  clockSyncRttMs?: number;
  warmupMs: number;
  startMonotonicTs: number;
  endMonotonicTs: number;
  mainThreadStart?: MainThreadProbeReading;
  mainThreadEnd?: MainThreadProbeReading;
};

/** Host totals of one steady poll (internal to `summarizeSteadyWindow`). */
export type PollTotals = {
  ws: number;
  hasWs: boolean;
  cpu: number;
  hasCpu: boolean;
  wsByType: Map<string, number>;
  countByType: Map<string, number>;
};
