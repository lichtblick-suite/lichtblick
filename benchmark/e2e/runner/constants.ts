// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import path from "node:path";

import type { ScreenshotTimings } from "./types";

/** Host sampling + telemetry drain cadence (matches the 1 Hz telemetry publish cadence). */
export const SAMPLE_INTERVAL_MS = 1000;

/** Sampling window for scenarios without their own `durationMs` (synthetic pipelines). */
export const DEFAULT_SAMPLE_DURATION_MS = 5_000;

/** Max records per `lichtblickTelemetry.drain()` call and drain calls per sampling tick. */
export const DRAIN_BATCH_SIZE = 2_000;
export const MAX_DRAINS_PER_TICK = 10;
/**
 * Upper bound of `drainUntilEmpty` loops (each up to `MAX_DRAINS_PER_TICK` batches), so a page that
 * keeps producing records cannot stall the final drain forever.
 */
export const MAX_TELEMETRY_DRAIN_ITERATIONS = 100;

/** How long to wait for `datasource.close` end after asking the page to close the source. */
export const CLOSE_EVENT_TIMEOUT_MS = 10_000;
export const CLOSE_EVENT_POLL_INTERVAL_MS = 250;

/** Wait slightly longer than one telemetry publish interval so final gauges/counters are published. */
export const PUBLISH_SETTLE_MS = 1_100;

/** How long to wait for a real-pipeline scenario's own auto-pause (`durationMs`) after the window. */
export const AUTO_PAUSE_TIMEOUT_MS = 3_000;

/** Timeout of the fallback Pause click of real-pipeline scenarios. */
export const PAUSE_CLICK_TIMEOUT_MS = 2_000;

/**
 * Crash detection: after a run failed with an error, how long to wait before collecting the runner
 * events, so a `crash` page event or an Electron `*-process-gone` record racing the error lands.
 */
export const RUNNER_EVENT_GRACE_MS = 1_000;

/**
 * `loaded` screenshot: how long to wait for the scenario's "loaded" event (see
 * `runner/screenshots.ts`) before capturing anyway, and the extra delay that lets panels paint.
 */
export const SCREENSHOT_LOADED_FALLBACK_MS = 5_000;
export const SCREENSHOT_PAINT_DELAY_MS = 500;
/** Poll interval for the "loaded" event (in-memory check of drained records, no page call). */
export const SCREENSHOT_LOADED_POLL_INTERVAL_MS = 100;
/** Upper bound of a single `page.screenshot()` (heavy SwiftShader 3D frames can be slow). */
export const SCREENSHOT_TIMEOUT_MS = 10_000;

export const BENCHMARK_DIR = path.resolve(__dirname, "../..");
export const ARTIFACTS_DIR = path.join(BENCHMARK_DIR, ".artifacts");
/** Checkpoint screenshots of scenario runs (`runner/screenshots.ts`). */
export const SCREENSHOTS_DIR = path.join(ARTIFACTS_DIR, "screenshots");
/** Runtime-generated MCAP fixtures (gitignored with the rest of `.artifacts`). */
export const FIXTURES_DIR = path.join(ARTIFACTS_DIR, "fixtures");
/** Output of `yarn benchmark:build:prod` (static web build). */
export const WEB_BUILD_DIR = path.join(BENCHMARK_DIR, ".webpack");
/** Output of `yarn benchmark:desktop:build:prod` (standalone Electron shell). */
export const DESKTOP_BUILD_DIR = path.join(BENCHMARK_DIR, ".webpack-desktop");

/** Bytes per KB (Electron `ProcessMetric` and `ps` RSS memory are in KB). */
export const KB = 1024;

/** `maxBuffer` of the `ps` calls of the web host collector. */
export const PS_MAX_BUFFER_BYTES = 16 * 1024 * 1024;

/** Name of the env variable that selects the screenshot mode (`BENCHMARK_SCREENSHOTS`). */
export const SCREENSHOTS_ENV_VAR = "BENCHMARK_SCREENSHOTS";

/** `BENCHMARK_SCREENSHOTS` values that disable screenshots. */
export const SCREENSHOTS_DISABLING_ENV_VALUES = new Set(["0", "false", "off", "no"]);

/** Default `ScenarioScreenshotter` timings. */
export const DEFAULT_SCREENSHOT_TIMINGS: ScreenshotTimings = {
  loadedFallbackMs: SCREENSHOT_LOADED_FALLBACK_MS,
  paintDelayMs: SCREENSHOT_PAINT_DELAY_MS,
  pollIntervalMs: SCREENSHOT_LOADED_POLL_INTERVAL_MS,
  timeoutMs: SCREENSHOT_TIMEOUT_MS,
};

/** `globalThis` key of the Electron main-process buffer of `*-process-gone` records. */
export const PROCESS_GONE_BUFFER_KEY = "__lichtblickBenchmarkProcessGone";

/** `window` key of the per-run document marker used to tell reloads from same-document navigations. */
export const DOCUMENT_MARKER_KEY = "__lichtblickBenchmarkRunnerDocument";

/** Titles rendered by `PanelErrorBoundary` and the app-level `ErrorBoundary`. */
export const ERROR_BOUNDARY_TITLES: readonly string[] = [
  "This panel encountered an unexpected error",
  "The app encountered an unexpected error",
];

/**
 * Render calibration (`runner/calibration.ts`): how long `requestAnimationFrame` is counted on a
 * blank page before each scenario to measure the display refresh ceiling (`fpsCeiling`), and the
 * upper bound of that measurement (a page that never paints resolves with what it has).
 */
export const FPS_CALIBRATION_DURATION_MS = 2000;
export const FPS_CALIBRATION_TIMEOUT_MS = 5000;

/** Page the render calibration runs on (same browser/GPU process, no app code). */
export const CALIBRATION_PAGE_URL = "about:blank";

/**
 * Measured refresh rates below this are treated as implausible (throttled/hidden page): the
 * late-frame threshold then stays at the 60 Hz default (`LATE_FRAME_THRESHOLD_MS`).
 */
export const MIN_PLAUSIBLE_FPS_CEILING = 20;

/** `run.environment.glRenderer` when the page cannot create a WebGL context. */
export const GL_RENDERER_UNAVAILABLE = "unavailable";

/** How long to wait for the page's `window.lichtblickScenario` (scenario bootstrap) to describe it. */
export const SCENARIO_DESCRIBE_TIMEOUT_MS = 10_000;
