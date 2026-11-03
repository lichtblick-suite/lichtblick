// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Browser, ElectronApplication, Page } from "@playwright/test";

import type { CumulativeCpuReading, ToggleArm, ToggleWindowRecording } from "./toggleBlocks.types";
import type {
  BenchmarkPlatform,
  BenchmarkResultV1,
  HostProcessSample,
  RunEnvironment,
  RunnerEvent,
  TelemetryRecord,
} from "../result/schemaV1";
import type { MainThreadProbeReading } from "../result/steadyWindow.types";
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
  /**
   * Cumulative CPU seconds of every app process, read without a page call (web: CDP
   * `SystemInfo.getProcessInfo` `cpuTime`; Electron: `app.getAppMetrics()`
   * `cpu.cumulativeCPUUsage`). Required by the toggle A/B; rejects when unavailable.
   */
  readCumulativeCpu?(): Promise<CumulativeCpuReading[]>;
  describe(): RunEnvironment;
}

/** A launched target owning its app instance (Electron app / Chromium browser). */
export type DisposableBenchmarkTarget = BenchmarkTarget & {
  /** Closes the app instance. Idempotent. */
  dispose(): Promise<void>;
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

/**
 * Overhead A/B measurement (`runScenario`): after the page API is ready, `warmupMs` of 1 Hz ticks,
 * then exactly `polls` host polls on a fixed schedule (see `runner/steadyWindow.ts`), summarized as
 * `summary.steadyWindow`. Also installs the main-thread probe and overrides a scenario's page
 * auto-pause so it lands after the window.
 */
export type SteadyMeasurement = { mode: "steady"; warmupMs: number; polls: number };

/**
 * Toggle A/B measurement (`runScenario`, see `runner/toggleWindow.ts`): telemetry installed on,
 * `warmupMs`, then one block of `blockMs` per entry of `arms` with telemetry switched off / on
 * in-page, CPU from cumulative process CPU time after `settleMs`. No main-thread probe; the
 * scenario's page auto-pause moves past the last block. The v1 result is not an overhead steady
 * result (no `summary.steadyWindow`): the run's output is `ScenarioRunResult.toggle`.
 */
export type ToggleMeasurement = {
  mode: "toggle";
  warmupMs: number;
  arms: readonly ToggleArm[];
  blockMs: number;
  settleMs: number;
  /**
   * Profiled period after the last block with telemetry on (direct CPU attribution, CDP
   * `Profiler` at `OVERHEAD_PROFILE_SAMPLING_INTERVAL_US`); none when absent or 0.
   */
  profileMs?: number;
  /**
   * What the blocks switch off / on: `telemetry` (default, `setTelemetryActive`) or `frameProbe`
   * (`setFrameProbeActive`: only the bare benchmark FPS probe frame loop, in a page installed with
   * `?telemetry=off`, i.e. `telemetryEnabled: false`).
   */
  toggled?: ToggleTarget;
};

/** Page switch of the toggle blocks (`ToggleMeasurement.toggled`). */
export type ToggleTarget = "telemetry" | "frameProbe";

/** `window` carrying the runner's main-thread probe (`runner/mainThreadProbe.ts`). */
export type MainThreadProbeWindow = Record<string, { read(): MainThreadProbeReading } | undefined>;

export type RunScenarioOptions = {
  /** Default true; false adds `?telemetry=off` (overhead A/B baseline). */
  telemetryEnabled?: boolean;
  /**
   * Default true; false adds `?telemetry.uaMemory=off` (no `measureUserAgentSpecificMemory()`
   * probe; overhead A/B `on-noUa` arm).
   */
  uaMemoryProbe?: boolean;
  /**
   * Overhead A/B steady window (relaunch) or toggle blocks; absent: the normal deadline-driven
   * scenario window.
   */
  measurement?: SteadyMeasurement | ToggleMeasurement;
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
  /** Toggle A/B runs only: the blocks and every drained record (attributed to blocks later). */
  toggle?: ToggleWindowRecording & {
    clockSyncRttMs: number;
    records: readonly TelemetryRecord[];
  };
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
