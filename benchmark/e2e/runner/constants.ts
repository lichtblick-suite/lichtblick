// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import path from "node:path";

import type { BundleLayout } from "./bundleSourceResolver.types";
import type { OverheadArm, OverheadComparison, OverheadMethod } from "./overhead.types";
import type { ScreenshotTimings } from "./types";
import type { BenchmarkPlatform } from "../result/schemaV1";
import type { WebBrowserV1 } from "../result/schemaV1.types";

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
/**
 * Longer MCAP fixtures of the overhead A/B (`overheadFixtureSet`), cached apart from the scenario
 * fixtures (own manifest), one subdirectory per duration (`overhead/<seconds>s/`), and served
 * under `/fixtures/<OVERHEAD_FIXTURES_SUBDIR>/<seconds>s/`.
 */
export const OVERHEAD_FIXTURES_SUBDIR = "overhead";
export const OVERHEAD_FIXTURES_DIR = path.join(FIXTURES_DIR, OVERHEAD_FIXTURES_SUBDIR);
/** Output of `yarn benchmark:build:prod` (static web build). */
export const WEB_BUILD_DIR = path.join(BENCHMARK_DIR, ".webpack");
/** Output of `yarn benchmark:desktop:build:prod` (standalone Electron shell). */
export const DESKTOP_BUILD_DIR = path.join(BENCHMARK_DIR, ".webpack-desktop");

/**
 * Renderer scripts and external source maps of each benchmark build, with the webpack `context`
 * their map `sources` are relative to (`benchmark/webpack*.config.ts`); read by the direct CPU
 * attribution (`runner/bundleSourceResolver.ts`).
 */
export const RENDERER_BUNDLE_LAYOUTS: Readonly<Record<BenchmarkPlatform, BundleLayout>> = {
  web: {
    buildDir: WEB_BUILD_DIR,
    contextDir: path.join(BENCHMARK_DIR, "src"),
    repoRoot: path.resolve(BENCHMARK_DIR, ".."),
  },
  electron: {
    buildDir: path.join(DESKTOP_BUILD_DIR, "renderer"),
    contextDir: path.join(BENCHMARK_DIR, "desktop", "renderer"),
    repoRoot: path.resolve(BENCHMARK_DIR, ".."),
  },
};

/** Bytes per KB (Electron `ProcessMetric` and `ps` RSS memory are in KB). */
export const KB = 1024;

/** `maxBuffer` of the `ps` calls of the web host collector. */
export const PS_MAX_BUFFER_BYTES = 16 * 1024 * 1024;

/** Telemetry overhead targets (see `overhead.ts`). */
export const OVERHEAD_TARGETS = {
  cpuDeltaRelativeMax: 0.02,
  memDeltaBytesMax: 20 * 1024 * 1024,
} as const;

/** Base and treatment arm of each overhead comparison (deltas are treatment − base). */
export const OVERHEAD_COMPARISONS: Readonly<
  Record<OverheadComparison, { base: OverheadArm; treatment: OverheadArm }>
> = {
  "on-vs-off": { base: "off", treatment: "on" },
  "onNoUa-vs-off": { base: "off", treatment: "on-noUa" },
  "on-vs-onNoUa": { base: "on-noUa", treatment: "on" },
};

/** Scenarios of the telemetry overhead A/B (`overhead.benchmark.spec.ts`). */
export const OVERHEAD_SCENARIOS = ["sinewave", "mcap-multi-ingest", "pointcloud"] as const;

/**
 * Overhead A/B steady window (`RunScenarioOptions.measurement`): warm-up after the page API is
 * ready (loading, first frames; telemetry is still drained), then this many host polls on a fixed
 * 1 Hz schedule.
 */
export const OVERHEAD_WARMUP_MS = 3_000;
/** Default steady polls (`BENCHMARK_OVERHEAD_POLLS`) and the lowest accepted value. */
export const OVERHEAD_STEADY_POLLS = 10;
export const OVERHEAD_MIN_STEADY_POLLS = 5;

/**
 * Telemetry drain cadence of a steady window. The drains run in their own sequential loop, apart
 * from the host polls, so a busy renderer delays only the drains, never a poll. The page sink holds
 * `DEFAULT_TELEMETRY_CAPACITY` = 8192 records; the overhead scenarios emit ≤ ~60 records/s, so a
 * 2 s cadence (even with drains delayed by seconds) stays far below an overflow.
 */
export const OVERHEAD_DRAIN_INTERVAL_MS = 2_000;

/**
 * Page clock round trips before a steady window (`syncPageClock`): the one with the smallest round
 * trip sets the Node → page clock offset used to stamp the host polls without a page call.
 */
export const CLOCK_SYNC_ROUNDS = 5;

/**
 * Slack added to the steady window when overriding a scenario's page auto-pause
 * (`?scenario.durationMs=`), so the pause never lands inside the window.
 */
export const OVERHEAD_DURATION_MARGIN_MS = 2_000;

/**
 * Data beyond the overhead page auto-pause in the overhead MCAP fixtures
 * (`overheadFixtureOptionsForAutoPause`): covers the loading time before playback starts, so the
 * player still streams data at the last steady poll instead of idling at the end of the file.
 */
export const OVERHEAD_FIXTURE_DATA_MARGIN_MS = 5_000;

/**
 * Chromium build of every overhead A/B arm on web. Only the full Chromium (new headless) provides
 * `performance.measureUserAgentSpecificMemory()`; Playwright's default `chromium-headless-shell`
 * rejects every call with a `SecurityError`, which would make the UA-memory arm meaningless. All
 * arms use it, so the A/B stays within one build; scenario runs keep the headless shell.
 */
export const OVERHEAD_WEB_BROWSER: WebBrowserV1 = "chromium";
/** Defaults of the overhead env knobs (`parseOverheadConfig`). */
export const OVERHEAD_DEFAULT_REPEATS = 5;
export const OVERHEAD_DEFAULT_WARMUP_RUNS = 1;

/**
 * Measurement methods of the overhead A/B (`BENCHMARK_OVERHEAD_METHOD`): `toggle` (one launch,
 * telemetry switched off/on in-process in ABBA blocks; CPU verdict only), `relaunch` (a fresh
 * launch per arm and repeat; CPU and memory) or `both` (CPU verdict from toggle, memory verdict
 * from relaunch).
 */
export const OVERHEAD_METHODS: readonly OverheadMethod[] = ["toggle", "relaunch", "both"];
export const OVERHEAD_DEFAULT_METHOD: OverheadMethod = "both";

/**
 * Toggle A/B: ABBA quartets of 4 blocks (`BENCHMARK_OVERHEAD_TOGGLE_QUARTETS`), the statistical
 * unit, and the lowest accepted value. A run below `MIN_QUARTETS_FOR_VERDICT` = 6 included quartets
 * is a smoke test (always `inconclusive`). The default (40 blocks, 2 min of blocks at 3 s) leaves a
 * verdict with up to 4 excluded quartets.
 */
export const OVERHEAD_TOGGLE_DEFAULT_QUARTETS = 10;
export const OVERHEAD_TOGGLE_MIN_QUARTETS = 4;
/** Toggle A/B: block length incl. settle (`BENCHMARK_OVERHEAD_TOGGLE_BLOCK_MS`) and its minimum. */
export const OVERHEAD_TOGGLE_DEFAULT_BLOCK_MS = 3_000;
export const OVERHEAD_TOGGLE_MIN_BLOCK_MS = 1_000;
/**
 * Toggle A/B: start of every block excluded from the CPU measurement. The `setTelemetryActive` page
 * call (queued behind an in-flight drain), the collectors' final publish and the switch itself
 * land here, so the measured part only sees the new state.
 */
export const OVERHEAD_TOGGLE_SETTLE_MS = 500;
/**
 * Toggle A/B: warm-up after the page API is ready, before the first block (telemetry on, drained).
 * Longer than the relaunch `OVERHEAD_WARMUP_MS`: a single run has no later window to absorb the
 * start-up ramp, and a ramp inside the first blocks biases the first quartets (Electron sinewave's
 * CPU still rose ~20 % between 3 s and ~9 s after ready).
 */
export const OVERHEAD_TOGGLE_WARMUP_MS = 10_000;

/**
 * Direct CPU attribution (toggle A/B only): profiled period after the toggle blocks, telemetry on
 * (`BENCHMARK_OVERHEAD_PROFILE_MS`, 0 disables). 10 s at 100 µs ≈ 10⁵ samples of a busy thread.
 */
export const OVERHEAD_PROFILE_DEFAULT_MS = 10_000;
/**
 * CDP `Profiler.setSamplingInterval` of the profiled period, µs: fine enough that short
 * telemetry callbacks (≪ 1 ms) are sampled, coarse enough that the sampler stays cheap. The
 * profiler's own overhead inflates every category alike, so the telemetry share is unaffected.
 */
export const OVERHEAD_PROFILE_SAMPLING_INTERVAL_US = 100;

/** Env variables of the overhead A/B (see `runner/overheadSchedule.ts`). */
export const OVERHEAD_ENV = {
  repeats: "BENCHMARK_OVERHEAD_REPEATS",
  warmupRuns: "BENCHMARK_OVERHEAD_WARMUP_RUNS",
  uaArm: "BENCHMARK_OVERHEAD_UA_ARM",
  gate: "BENCHMARK_OVERHEAD_GATE",
  polls: "BENCHMARK_OVERHEAD_POLLS",
  method: "BENCHMARK_OVERHEAD_METHOD",
  toggleQuartets: "BENCHMARK_OVERHEAD_TOGGLE_QUARTETS",
  toggleBlockMs: "BENCHMARK_OVERHEAD_TOGGLE_BLOCK_MS",
  profileMs: "BENCHMARK_OVERHEAD_PROFILE_MS",
  frameProbeArm: "BENCHMARK_OVERHEAD_FRAME_PROBE_ARM",
} as const;

/**
 * Test timeout of one overhead scenario: a fixed base plus, per run, a setup budget (app launch,
 * render calibration, load, teardown) on top of the run's page auto-pause (warm-up + polls +
 * margin; 15 s with 10 polls, so 75 s per run).
 */
export const OVERHEAD_RUN_SETUP_BUDGET_MS = 60_000;
export const OVERHEAD_TIMEOUT_BASE_MS = 60_000;

/**
 * v1 result file name variant per overhead arm (`resultV1FileName`): every overhead run is tagged
 * `-overhead` (the off arm also gets `-telemetry-off`), so it never looks like a scenario run.
 */
export const OVERHEAD_ARM_FILE_VARIANTS: Readonly<Record<OverheadArm, string>> = {
  off: "overhead",
  on: "overhead",
  "on-noUa": "overhead-ua-memory-off",
};

/**
 * `window` key of the runner-injected main-thread probe (`runner/mainThreadProbe.ts`), installed
 * identically in every overhead arm.
 */
export const MAIN_THREAD_PROBE_KEY = "__benchmarkMainThreadProbe";

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
