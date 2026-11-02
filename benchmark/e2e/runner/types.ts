// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Browser, ElectronApplication, Page } from "@playwright/test";

import type {
  BenchmarkPlatform,
  BenchmarkResultV1,
  HostProcessSample,
  RunEnvironment,
  RunnerEvent,
} from "../result/schemaV1";
import type { BenchmarkArtifact, LegacyProcessMetric } from "../types";

export type { BenchmarkPlatform, HostProcessSample, RunEnvironment };

/** One host-metrics poll: normalized per-process samples + the legacy artifact representation. */
export type HostMetricsSnapshot = {
  samples: HostProcessSample[];
  /**
   * Entries for the legacy artifact's `memorySamples[].metrics`: Electron's raw `ProcessMetric`s
   * (unchanged), or for web a minimal ProcessMetric-compatible object (memory in KB).
   */
  legacyMetrics: LegacyProcessMetric[];
};

/**
 * Platform adapter driving one benchmark app instance (Electron app or web browser) for
 * `runScenario`. Created by the Playwright fixtures (`fixtures/benchmark.ts`).
 */
export interface BenchmarkTarget {
  readonly platform: BenchmarkPlatform;
  readonly page: Page;
  /** Electron only: the app's main-process handle (crash detection, `runner/crashDetection.ts`). */
  readonly electronApp?: ElectronApplication;
  /** URL of the benchmark page with the given query params. */
  scenarioUrl(params: URLSearchParams): string;
  /** Polls the host (OS-level) process metrics, stamped with the page monotonic time `tsMonotonic`. */
  collectHostMetrics(tsMonotonic: number): Promise<HostMetricsSnapshot>;
  describe(): RunEnvironment;
}

/** A launched target owning its app instance (Electron app / Chromium browser). */
export type DisposableBenchmarkTarget = BenchmarkTarget & {
  /** Closes the app instance. Idempotent. */
  dispose(): Promise<void>;
};

export type OverheadTargets = { cpuDeltaRelativeMax: number; memDeltaBytesMax: number };

export type OverheadRunStats = {
  telemetryEnabled: boolean;
  hostPolls: number;
  medianTotalCpuPercent: number;
  meanTotalWorkingSetBytes: number;
  peakTotalWorkingSetBytes: number;
};

export type OverheadDeltas = {
  cpuDeltaPctPoints: number;
  /** Undefined when the off median is 0 but on is not (relative change undefined). */
  cpuDeltaRelative?: number;
  memDeltaBytes: number;
};

export type OverheadReport = {
  schemaVersion: 1;
  kind: "overhead";
  platform: BenchmarkPlatform;
  scenarioId: string;
  createdAtWall: string;
  off: OverheadRunStats;
  on: OverheadRunStats;
  deltas: OverheadDeltas;
  targets: OverheadTargets;
  withinTargets: boolean;
  /** Per-target evaluation. */
  within: { cpu: boolean; memory: boolean };
};

export type ScreenshotCheckpoint = "loaded" | "mid" | "end";

export type ScreenshotArtifact = {
  checkpoint: ScreenshotCheckpoint;
  path: string;
};

/** The part of Playwright's `Page` used here (structurally compatible with `Page`). */
export interface ScreenshotPage {
  screenshot(options: {
    path: string;
    timeout: number;
    caret?: "hide" | "initial";
  }): Promise<unknown>;
}

/** The part of Playwright's `TestInfo` used here (structurally compatible with `TestInfo`). */
export interface ScreenshotAttacher {
  attach(name: string, options: { path: string; contentType: string }): Promise<void>;
}

/**
 * Which checkpoints a run captures:
 * - `none`: no screenshots.
 * - `end`: only `end` (post-drain, never affects a metric).
 * - `all`: `loaded` + `mid` + `end`.
 */
export type ScreenshotMode = "none" | "end" | "all";

export type ScreenshotTimings = {
  loadedFallbackMs: number;
  paintDelayMs: number;
  pollIntervalMs: number;
  timeoutMs: number;
};

export type ScenarioScreenshotterOptions = {
  page: ScreenshotPage;
  dir: string;
  scenarioId: string;
  platform: BenchmarkPlatform;
  telemetryEnabled: boolean;
  /** Run timestamp shared with the run's JSON artifacts. */
  timestamp: number;
  /** Each capture is attached to the Playwright report right away (also if the test fails later). */
  attacher?: ScreenshotAttacher;
  timings?: Partial<ScreenshotTimings>;
};

export type RunScenarioOptions = {
  /** Default true; false adds `?telemetry=off` (overhead A/B baseline). */
  telemetryEnabled?: boolean;
  /** Fixture URLs for scenarios with `usesMcapFixtures` (passed as `?ds.url=<a>,<b>,…`). */
  fixtureUrls?: readonly string[];
  /**
   * Capture viewport screenshots (`runner/screenshots.ts`) into `benchmark/.artifacts/screenshots/`.
   * Default false. Only `end` (after all measurement) by default; `BENCHMARK_SCREENSHOTS=all` adds
   * `loaded`/`mid` (distorts metrics), `=0` disables (see `resolveScreenshotMode`).
   */
  screenshots?: boolean;
  /** Playwright `testInfo`: each screenshot is attached to the report as soon as it is taken. */
  testInfo?: ScreenshotAttacher;
};

export type ScenarioRunResult = {
  legacy: BenchmarkArtifact;
  result: BenchmarkResultV1;
  /** Epoch ms at the start of the run; shared by the run's JSON artifact and screenshot names. */
  runTimestamp: number;
  /** Screenshots actually written (failed captures are skipped), in capture order. */
  screenshots: readonly ScreenshotArtifact[];
};

/** One `SystemInfo.getProcessInfo` entry (`cpuTime` = cumulative CPU seconds). */
export type CdpProcessInfo = { type: string; id: number; cpuTime: number };

export type PsTreeRow = {
  pid: number;
  ppid: number;
  rssKb: number;
  cpuPercent: number;
  args: string;
};

export type WebHostCollectorOptions = {
  browser: Browser;
  /** Unique flag passed to the browser at launch; used by the `ps` fallback to find its tree. */
  marker: string;
};

/** Serializable record pushed by the Electron main-process listeners. */
export type ProcessGoneRecord =
  | {
      source: "render-process-gone";
      monotonicTs: number;
      reason: string;
      exitCode: number;
      url?: string;
    }
  | {
      source: "child-process-gone";
      monotonicTs: number;
      reason: string;
      exitCode: number;
      /** Electron `details.type`, e.g. "GPU", "Utility". */
      type: string;
    };

export type CrashDetection = {
  /**
   * Arms reload detection. Call after the runner's own navigation, once the app is ready: marks
   * the current document so later same-document navigations are told apart from reloads.
   */
  arm(): Promise<void>;
  /** Starts the runner's closing: detaches, drains the Electron buffer, returns the events. Idempotent. */
  stop(): Promise<RunnerEvent[]>;
};

export type ErrorBoundaryHit = {
  title: string;
  /** `error.message` shown by the boundary ("" if not found). */
  message: string;
};
