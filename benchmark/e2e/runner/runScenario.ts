// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Page } from "@playwright/test";
import os from "node:os";
import { setTimeout as delay } from "node:timers/promises";

import { writeResultV1 } from "./artifacts";
import { calibrateRendering } from "./calibration";
import { nodeMonotonicNow, syncPageClock, toPageClock } from "./clockSync";
import {
  CLOCK_SYNC_ROUNDS,
  CLOSE_EVENT_POLL_INTERVAL_MS,
  CLOSE_EVENT_TIMEOUT_MS,
  DEFAULT_SAMPLE_DURATION_MS,
  AUTO_PAUSE_TIMEOUT_MS,
  OVERHEAD_DRAIN_INTERVAL_MS,
  OVERHEAD_DURATION_MARGIN_MS,
  OVERHEAD_PROFILE_SAMPLING_INTERVAL_US,
  PAUSE_CLICK_TIMEOUT_MS,
  PUBLISH_SETTLE_MS,
  RUNNER_EVENT_GRACE_MS,
  SAMPLE_INTERVAL_MS,
  SCENARIO_DESCRIBE_TIMEOUT_MS,
  SCREENSHOTS_DIR,
  ERROR_BOUNDARY_TITLES,
} from "./constants";
import { captureMainThreadProfile } from "./cpuProfile";
import { formatRunnerEventsFailure, runnerNow, startCrashDetection } from "./crashDetection";
import { collectElectronMainProcessMetrics } from "./electronHostCollector";
import { collectErrorBoundaryHits, formatErrorBoundaryFailure } from "./errorBoundaries";
import { logicalCpuCount } from "./hostCpus";
import { installMainThreadProbe, readMainThreadProbe } from "./mainThreadProbe";
import { readOverheadPageState, withOverheadFields } from "./overheadPage";
import type { OverheadPageState } from "./overheadPage.types";
import type { RecordedFrameTime } from "./runScenario.types";
import { ScenarioScreenshotter, loadedEventName, resolveScreenshotMode } from "./screenshots";
import { SYSTEM_CLOCK, sampleSteadyWindow, steadyScenarioDurationMs } from "./steadyWindow";
import type { SteadyWindowRecording } from "./steadyWindow.types";
import { TelemetryDrainer, drainUntilEmpty, pageNow } from "./telemetryDrainer";
import { toggleScenarioDurationMs } from "./toggleBlocks";
import type { ToggleWindowRecording } from "./toggleBlocks.types";
import { sampleToggleWindow } from "./toggleWindow";
import type {
  BenchmarkTarget,
  HostMetricsSnapshot,
  HostProcessSample,
  RunEnvironment,
  RunScenarioOptions,
  ScenarioRunResult,
  SteadyMeasurement,
  ToggleMeasurement,
} from "./types";
import { SCENARIO_DURATION_MS_PARAM } from "../../src/scenarios/constants";
import type {
  LichtblickScenarioControlWindow,
  ScenarioDescriptor,
} from "../../src/scenarios/scenarioControl";
import {
  LATE_FRAME_THRESHOLD_QUERY_PARAM,
  TELEMETRY_OFF_VALUE,
  TELEMETRY_QUERY_PARAM,
  UA_MEMORY_QUERY_PARAM,
} from "../../src/telemetry/constants";
import type { FrameProbeToggleRequest, LichtblickTelemetryWindow } from "../../src/telemetry/types";
import {
  BenchmarkResultV1,
  ListenerDispatchSample,
  PersistedResultV1,
  PersistedRunInfoV1,
  RenderCalibrationV1,
  RunInfoV1,
  RunnerEvent,
  buildResultV1,
} from "../result/schemaV1";
import { repeatWhile } from "../shared/sequential";
import type { BenchmarkArtifact, FrameTimeSample, MemorySample, ScenarioUnderTest } from "../types";

/** Environment fields shared by all platforms (host machine). */
export function describeHost(): RunEnvironment {
  return {
    os: `${os.platform()} ${os.release()}`,
    arch: os.arch(),
    ci: process.env.CI != undefined && process.env.CI !== "" && process.env.CI !== "false",
    cpuModel: os.cpus()[0]?.model.trim() ?? "unknown",
    logicalCpus: logicalCpuCount(),
    totalMemBytes: os.totalmem(),
  };
}

/**
 * Page auto-pause duration of an overhead A/B run (steady window or toggle blocks) plus
 * `OVERHEAD_DURATION_MARGIN_MS`. Undefined for normal runs and scenarios without auto-pause.
 */
function measurementAutoPauseMs(
  scenario: ScenarioUnderTest,
  measurement: RunScenarioOptions["measurement"],
): number | undefined {
  if (measurement == undefined || scenario.durationMs == undefined) {
    return undefined;
  }
  if (measurement.mode === "toggle") {
    return toggleScenarioDurationMs({
      warmupMs: measurement.warmupMs,
      blocks: measurement.arms.length,
      blockMs: measurement.blockMs,
      profileMs: measurement.profileMs ?? 0,
      marginMs: OVERHEAD_DURATION_MARGIN_MS,
    });
  }
  return steadyScenarioDurationMs({
    warmupMs: measurement.warmupMs,
    polls: measurement.polls,
    intervalMs: SAMPLE_INTERVAL_MS,
    marginMs: OVERHEAD_DURATION_MARGIN_MS,
  });
}

/**
 * Page URL query of a scenario run. `calibration.lateFrameThresholdMs` (measured refresh ceiling,
 * see `runner/calibration.ts`) is passed as `?telemetry.lateFrameThresholdMs=`. Overhead A/B runs
 * may add `?telemetry.uaMemory=off` (`uaMemoryProbe: false`) and, in steady / toggle mode for
 * scenarios with a page auto-pause, `?scenario.durationMs=` so the pause lands after the window.
 */
export function buildScenarioParams(
  scenario: ScenarioUnderTest,
  options: RunScenarioOptions,
  calibration?: Pick<RenderCalibrationV1, "lateFrameThresholdMs">,
): URLSearchParams {
  const params = new URLSearchParams({ scenario: scenario.scenarioId });
  if (options.telemetryEnabled === false) {
    params.set(TELEMETRY_QUERY_PARAM, TELEMETRY_OFF_VALUE);
  }
  if (options.uaMemoryProbe === false) {
    params.set(UA_MEMORY_QUERY_PARAM, TELEMETRY_OFF_VALUE);
  }
  const autoPauseMs = measurementAutoPauseMs(scenario, options.measurement);
  if (autoPauseMs != undefined) {
    params.set(SCENARIO_DURATION_MS_PARAM, String(autoPauseMs));
  }
  if (calibration != undefined) {
    params.set(LATE_FRAME_THRESHOLD_QUERY_PARAM, String(calibration.lateFrameThresholdMs));
  }
  if (scenario.usesMcapFixtures === true) {
    if (options.fixtureUrls == undefined || options.fixtureUrls.length === 0) {
      throw new Error(`Scenario ${scenario.scenarioId} needs MCAP fixture URLs`);
    }
    params.set("ds.url", options.fixtureUrls.join(","));
  }
  return params;
}

/**
 * The page's self-description of the active scenario (`window.lichtblickScenario.describe()`),
 * waiting for the scenario bootstrap to install the API.
 */
async function describeScenario(page: Page): Promise<ScenarioDescriptor> {
  await page.waitForFunction(
    () => (window as LichtblickScenarioControlWindow).lichtblickScenario != undefined,
    undefined,
    { timeout: SCENARIO_DESCRIBE_TIMEOUT_MS },
  );
  return await page.evaluate(() =>
    (window as LichtblickScenarioControlWindow).lichtblickScenario!.describe(),
  );
}

/** Default (non-overhead) window: 1 Hz ticks until the wall-clock `windowEnd` (deadline-driven). */
async function sampleDeadlineWindow(tick: () => Promise<void>, windowEnd: number): Promise<void> {
  // Ticks are timed and strictly sequential (each starts after the previous one's wait).
  await repeatWhile(
    () => Date.now() < windowEnd,
    async () => {
      const tickStart = Date.now();
      await tick();
      const remaining = Math.min(
        SAMPLE_INTERVAL_MS - (Date.now() - tickStart),
        windowEnd - Date.now(),
      );
      if (remaining > 0) {
        await delay(remaining);
      }
    },
  );
}

/**
 * Host collection of a steady window that never waits for the page. Electron: `app.getAppMetrics()`
 * in the main process (the target's own collector goes through the renderer's preload bridge, i.e.
 * a page call). Web: the target's collector (CDP `SystemInfo` on the browser session + `ps`).
 */
function steadyHostCollector(
  target: BenchmarkTarget,
): (monotonicTs: number) => Promise<HostMetricsSnapshot> {
  const { electronApp } = target;
  if (electronApp != undefined) {
    return async (monotonicTs) => await collectElectronMainProcessMetrics(electronApp, monotonicTs);
  }
  return async (monotonicTs) => await target.collectHostMetrics(monotonicTs);
}

/**
 * Overhead A/B steady window (`runner/steadyWindow.ts`) of a ready page: syncs the Node → page
 * clock once (smallest of `CLOCK_SYNC_ROUNDS` round trips), then samples with host polls stamped
 * from the Node clock, telemetry drains in their own loop every `OVERHEAD_DRAIN_INTERVAL_MS`, and
 * ends with a full drain.
 */
async function recordSteadyWindow({
  target,
  measurement,
  drainer,
  onHostSnapshot,
}: {
  target: BenchmarkTarget;
  measurement: SteadyMeasurement;
  drainer: TelemetryDrainer;
  onHostSnapshot: (host: HostMetricsSnapshot) => void;
}): Promise<SteadyWindowRecording> {
  const { page } = target;
  const clockOffset = await syncPageClock({
    readPageNow: async () => await pageNow(page),
    nodeNow: nodeMonotonicNow,
    rounds: CLOCK_SYNC_ROUNDS,
  });
  const collectHost = steadyHostCollector(target);
  const recording = await sampleSteadyWindow({
    stamp: () => toPageClock(nodeMonotonicNow(), clockOffset),
    poll: async (monotonicTs) => {
      onHostSnapshot(await collectHost(monotonicTs));
    },
    drain: async () => {
      await drainer.drain();
    },
    readProbe: async () => await readMainThreadProbe(page),
    warmupMs: measurement.warmupMs,
    polls: measurement.polls,
    intervalMs: SAMPLE_INTERVAL_MS,
    drainIntervalMs: OVERHEAD_DRAIN_INTERVAL_MS,
    clock: SYSTEM_CLOCK,
  });
  // Final drain right after the window (the drain loop stopped at the last poll).
  await drainUntilEmpty(drainer);
  return { ...recording, clockSyncRttMs: clockOffset.rttMs };
}

/**
 * Switches the bare frame loop of a `?telemetry=off` page (`setFrameProbeActive`); never calls the
 * UA memory API (`uaCalls` 0). Throws if the page API lacks the switch (telemetry installed on).
 */
async function setFrameProbeActive(
  page: Page,
  request: FrameProbeToggleRequest,
): Promise<{ uaCalls: number }> {
  const result = await page.evaluate((pageRequest) => {
    const api = (window as LichtblickTelemetryWindow).lichtblickTelemetry!;
    return api.setFrameProbeActive?.(pageRequest);
  }, request);
  if (result == undefined) {
    throw new Error("Frame-probe toggle needs a page with ?telemetry=off (setFrameProbeActive)");
  }
  return { uaCalls: 0 };
}

/**
 * Toggle A/B blocks (`runner/toggleWindow.ts`) of a ready page: syncs the Node → page clock once,
 * then switches telemetry off / on per block (`window.lichtblickTelemetry.setTelemetryActive`; with
 * `measurement.toggled = "frameProbe"` only the frame loop via `setFrameProbeActive`) and
 * reads the target's cumulative process CPU (no page call) after each settle period and at each
 * block end; drains run in their own loop. With `measurement.profileMs`, profiles the main thread
 * after the blocks (`runner/cpuProfile.ts`). Ends with telemetry on and a full drain.
 */
async function recordToggleWindow({
  target,
  measurement,
  drainer,
}: {
  target: BenchmarkTarget;
  measurement: ToggleMeasurement;
  drainer: TelemetryDrainer;
}): Promise<ToggleWindowRecording & { clockSyncRttMs: number }> {
  const { page } = target;
  const readCpu = target.readCumulativeCpu?.bind(target);
  if (readCpu == undefined) {
    throw new Error(`${target.platform} target cannot read cumulative CPU (toggle A/B)`);
  }
  const clockOffset = await syncPageClock({
    readPageNow: async () => await pageNow(page),
    nodeNow: nodeMonotonicNow,
    rounds: CLOCK_SYNC_ROUNDS,
  });
  const recording = await sampleToggleWindow({
    stamp: () => toPageClock(nodeMonotonicNow(), clockOffset),
    setActive: async (arm) =>
      measurement.toggled === "frameProbe"
        ? await setFrameProbeActive(page, { active: arm === "on" })
        : await page.evaluate(
            (request) =>
              (window as LichtblickTelemetryWindow).lichtblickTelemetry!.setTelemetryActive(
                request,
              ),
            { active: arm === "on" },
          ),
    readCpu,
    drain: async () => {
      await drainer.drain();
    },
    arms: measurement.arms,
    warmupMs: measurement.warmupMs,
    blockMs: measurement.blockMs,
    settleMs: measurement.settleMs,
    drainIntervalMs: OVERHEAD_DRAIN_INTERVAL_MS,
    clock: SYSTEM_CLOCK,
    ...(measurement.profileMs != undefined &&
      measurement.profileMs > 0 && {
        profile: async () =>
          await captureMainThreadProfile(page, {
            durationMs: measurement.profileMs!,
            samplingIntervalUs: OVERHEAD_PROFILE_SAMPLING_INTERVAL_US,
            clock: SYSTEM_CLOCK,
          }),
      }),
  });
  await drainUntilEmpty(drainer);
  return { ...recording, clockSyncRttMs: clockOffset.rttMs };
}

/**
 * Real-pipeline teardown: makes sure playback is paused, then closes the data source in-page via
 * `window.lichtblickScenario.closeDataSource()` and waits for the `datasource.close` end event, so
 * close/cleanup events and final pool counters are captured. Bounded: if the event never arrives
 * the run continues (close events are optional in the result).
 *
 * Scenarios with `durationMs` auto-pause in the page at that deadline, which lands right around the
 * end of the runner's window. Clicking the Play/Pause toggle then races with the auto-pause (the
 * click can hit "Play" and restart playback from the start), so the runner waits for the auto-pause
 * to show "Play" and only clicks "Pause" as a fallback.
 */
async function pauseAndCloseDataSource(
  page: Page,
  scenario: ScenarioUnderTest,
  drainer: TelemetryDrainer,
  {
    waitForCloseEvent,
    autoPauseTimeoutMs = AUTO_PAUSE_TIMEOUT_MS,
  }: { waitForCloseEvent: boolean; autoPauseTimeoutMs?: number },
): Promise<void> {
  const autoPaused =
    scenario.durationMs != undefined &&
    (await page
      .getByRole("button", { name: "Play", exact: true })
      .waitFor({ state: "visible", timeout: autoPauseTimeoutMs })
      .then(
        () => true,
        () => false,
      ));
  if (!autoPaused) {
    const pause = page.getByRole("button", { name: "Pause", exact: true });
    if (await pause.isVisible().catch(() => false)) {
      await pause.click({ timeout: PAUSE_CLICK_TIMEOUT_MS }).catch(() => undefined);
    }
  }
  const closed = await page.evaluate(() => {
    const api = (window as LichtblickScenarioControlWindow).lichtblickScenario;
    api?.closeDataSource();
    return api != undefined;
  });
  if (!closed || !waitForCloseEvent) {
    return;
  }
  const deadline = Date.now() + CLOSE_EVENT_TIMEOUT_MS;
  // Polling: each poll waits, then drains, strictly after the previous one.
  await repeatWhile(
    () => !drainer.hasEvent("datasource.close", "end") && Date.now() < deadline,
    async () => {
      await delay(CLOSE_EVENT_POLL_INTERVAL_MS);
      await drainer.drain();
    },
  );
  if (!drainer.hasEvent("datasource.close", "end")) {
    console.warn("[runScenario] datasource.close end not observed within timeout");
  }
}

/**
 * Runs one scenario on `target` (platform agnostic): navigates to `?scenario=<id>`, samples host
 * process metrics and drains page telemetry at 1 Hz for the scenario window, captures teardown
 * telemetry, then builds the legacy artifact and the `benchmark-result.v1` document.
 *
 * Host samples are stamped with the page's monotonic clock read right before each poll, so host,
 * renderer and worker records share one timeline.
 *
 * With `options.screenshots` in mode `all` (`BENCHMARK_SCREENSHOTS=all`), `loaded`/`mid` screenshots are
 * taken by background tasks running next to the sampling loop (the loop's wall-clock deadline is
 * unchanged, so they don't shorten or extend the window; a capture can at most delay one tick's
 * page calls, and the next tick then starts sooner). A `loaded`/`mid` capture that would start
 * after the window deadline is skipped. The `end` screenshot (every mode but `none`; the only one
 * on web by default) is taken after all measurement (window, pause/close, final drain) and after
 * the result has been built, so it never affects any metric; the app is still open then (the
 * fixture closes it). For real pipelines it therefore shows the app after the data source closed.
 *
 * Render calibration (`runner/calibration.ts`): before anything else the page is navigated to a
 * blank document to measure the animation frame rate and the WebGL renderer; the derived late-frame
 * threshold is passed to the scenario page. The run's `run.scenario` is the page's own
 * `window.lichtblickScenario.describe()`, read after all measurement.
 *
 * Crash detection (`runner/crashDetection.ts`): listeners are attached before the first navigation
 * and reload detection is armed once the app is ready. A renderer crash, a gone Electron process or
 * an unexpected reload is recorded as `runnerEvents` in the v1 result; the run then **throws after
 * writing that result** (`writeResultV1`) so the evidence is kept. If such an event made the run
 * fail early (e.g. "Target crashed"), a partial result (whatever was sampled so far) is written.
 *
 * Overhead A/B steady mode (`options.measurement`, see `runner/steadyWindow.ts`): instead of the
 * deadline-driven window, `warmupMs` of 1 Hz host polls then a priming poll and exactly `polls`
 * polls on a fixed schedule. Those polls make no page call (stamped from the Node clock with a
 * once-measured page clock offset; Electron host metrics read in the main process); telemetry is
 * drained by a separate sequential loop and the main-thread probe (`runner/mainThreadProbe.ts`,
 * installed before navigation) is read before and after the window, so a busy renderer cannot
 * delay a poll. A scenario's page auto-pause is moved past the window; no screenshots. The
 * result gets `summary.steadyWindow`, `run.environment.collectors` and, with telemetry on,
 * `summary.telemetrySelf` (`runner/overheadPage.ts`). Normal runs are unchanged.
 *
 * Toggle A/B mode (`measurement.mode = "toggle"`, see `runner/toggleWindow.ts`): telemetry is
 * installed on and switched off / on in-page per block (or, with `toggled: "frameProbe"` and
 * telemetry off, only the bare frame loop); CPU comes from the target's cumulative
 * process CPU time (`readCumulativeCpu`). No probe, no screenshots, auto-pause moved past the last
 * block. The blocks and the drained records are returned as `toggle`; the v1 result (`run.mode`
 * "overhead", no steady window) is not meant to be written.
 *
 * Throws if any panel (or the app) rendered an error boundary by the end of the run.
 */
export async function runScenario(
  target: BenchmarkTarget,
  scenario: ScenarioUnderTest,
  options: RunScenarioOptions = {},
): Promise<ScenarioRunResult> {
  const { page } = target;
  const label = `${target.platform}/${scenario.scenarioId}`;
  const telemetryEnabled = options.telemetryEnabled !== false;
  const { measurement } = options;
  const runTimestamp = Date.now();
  const frameTimeSamples: FrameTimeSample[] = [];
  const listenerDispatchSamples: ListenerDispatchSample[] = [];
  const memorySamples: MemorySample[] = [];
  const hostSamples: HostProcessSample[] = [];

  // Given: the frame-time hook must exist before the page script runs.
  await page.exposeFunction("recordFrameTimes", (samples: RecordedFrameTime[]) => {
    for (const sample of samples) {
      frameTimeSamples.push({ stamp: sample.stamp, value: sample.value });
      if (sample.monotonicTs != undefined) {
        listenerDispatchSamples.push({ monotonicTs: sample.monotonicTs, value: sample.value });
      }
    }
  });

  // Before the run starts (and before crash detection, which would count the blank navigation).
  const calibration = await calibrateRendering(page);
  const startedAtWall = new Date().toISOString();
  console.debug(
    `[runScenario] ${label} started ${startedAtWall} (fps ceiling ${calibration.fpsCeiling}, ` +
      `GL ${calibration.glRenderer})`,
  );
  // Before the runner's own navigation: crashes are caught from the start, reloads once armed.
  const crashDetection = await startCrashDetection({ page, electronApp: target.electronApp });
  // Overhead A/B: same probe in every arm, installed before the scenario page loads.
  if (measurement?.mode === "steady") {
    await installMainThreadProbe(page);
  }
  const drainer = new TelemetryDrainer(page);
  const durationMs = scenario.durationMs ?? DEFAULT_SAMPLE_DURATION_MS;
  // Steady (overhead A/B) runs never take screenshots: a capture costs CPU and memory in one arm.
  const screenshotMode =
    measurement == undefined ? resolveScreenshotMode({ requested: options.screenshots }) : "none";
  let screenshotter: ScenarioScreenshotter | undefined;
  let steadyRecording: SteadyWindowRecording | undefined;
  let toggleRecording: (ToggleWindowRecording & { clockSyncRttMs: number }) | undefined;
  let overheadPageState: OverheadPageState = {};
  let startMonotonicTs: number | undefined;
  let windowEndMonotonicTs: number | undefined;
  let finishedAtWall: string | undefined;

  /** `run` without `scenario`: complete runs add it, a partial result of a failure may lack it. */
  const buildRun = (end: {
    endMonotonicTs: number;
    environment: RunEnvironment;
  }): Omit<RunInfoV1, "scenario"> => ({
    scenarioId: scenario.scenarioId,
    pipeline: scenario.pipeline,
    platform: target.platform,
    telemetryEnabled,
    startedAtWall,
    finishedAtWall: finishedAtWall ?? new Date().toISOString(),
    // Runner clock if the page never got ready (same epoch-anchored formula as the page clock).
    startMonotonicTs: startMonotonicTs ?? end.endMonotonicTs,
    endMonotonicTs: end.endMonotonicTs,
    ...(windowEndMonotonicTs != undefined && { windowEndMonotonicTs }),
    // Lets the viewer and the CI summary keep overhead A/B runs out of the scenario views.
    mode: measurement == undefined ? "scenario" : "overhead",
    sampleIntervalMs: SAMPLE_INTERVAL_MS,
    environment: { ...end.environment, ...calibration },
  });

  const buildResult = <TRun extends PersistedRunInfoV1>(
    run: TRun,
    runnerEvents: readonly RunnerEvent[],
  ) =>
    buildResultV1({
      run,
      pageRecords: drainer.records,
      drainedDropped: drainer.dropped,
      drainRealm: drainer.realm,
      hostSamples,
      listenerDispatchSamples,
      runnerEvents,
    });

  /** With runner events: writes the v1 result as evidence and returns the failure to throw. */
  const runnerEventsFailure = (result: PersistedResultV1, cause?: unknown): Error | undefined => {
    const events = result.runnerEvents ?? [];
    if (events.length === 0) {
      return undefined;
    }
    const resultPath = writeResultV1({ result, runTimestamp });
    return new Error(formatRunnerEventsFailure({ label, events, resultPath }), { cause });
  };

  let endMonotonicTs: number;
  let crossOriginIsolated: boolean;
  let scenarioDescriptor: ScenarioDescriptor;
  try {
    await page.goto(target.scenarioUrl(buildScenarioParams(scenario, options, calibration)));
    await page.waitForFunction(
      () => (window as LichtblickTelemetryWindow).lichtblickTelemetry != undefined,
    );
    // Initial navigation done and app ready: from now on a new document is an unexpected reload.
    await crashDetection.arm();

    startMonotonicTs = await pageNow(page);
    const windowStart = Date.now();
    const windowEnd = windowStart + durationMs;

    screenshotter =
      screenshotMode === "none"
        ? undefined
        : new ScenarioScreenshotter({
            page,
            dir: SCREENSHOTS_DIR,
            scenarioId: scenario.scenarioId,
            platform: target.platform,
            telemetryEnabled,
            timestamp: runTimestamp,
            attacher: options.testInfo,
          });
    if (screenshotMode === "all") {
      const loadedEvent = loadedEventName(scenario.pipeline);
      screenshotter?.startWindowCheckpoints({
        windowStartMs: windowStart,
        durationMs,
        isLoaded: () => drainer.hasEvent(loadedEvent, "instant"),
      });
    }

    const recordHost = (host: HostMetricsSnapshot): void => {
      hostSamples.push(...host.samples);
      memorySamples.push({ timestampMs: Date.now(), metrics: host.legacyMetrics });
    };

    // When: 1 Hz loop - deadline-driven, or the overhead A/B's fixed-schedule steady window.
    if (measurement == undefined) {
      /** One sampling tick: page clock → host metrics → drain. */
      const tick = async (): Promise<void> => {
        const ts = await pageNow(page);
        recordHost(await target.collectHostMetrics(ts));
        await drainer.drain();
      };
      await sampleDeadlineWindow(tick, windowEnd);
    } else if (measurement.mode === "toggle") {
      toggleRecording = await recordToggleWindow({ target, measurement, drainer });
    } else {
      steadyRecording = await recordSteadyWindow({
        target,
        measurement,
        drainer,
        onHostSnapshot: recordHost,
      });
    }
    finishedAtWall = new Date().toISOString();
    // End of the measured window (rates in `summary.pipeline`); teardown below is excluded.
    windowEndMonotonicTs =
      steadyRecording?.endMonotonicTs ??
      toggleRecording?.blocks.at(-1)?.endMonotonicTs ??
      (await pageNow(page));

    // A `loaded`/`mid` capture still in flight at the deadline finishes before teardown, so its page
    // round trips don't interleave with pause/close.
    await screenshotter?.settle();

    if (scenario.pipeline === "real") {
      await pauseAndCloseDataSource(page, scenario, drainer, {
        waitForCloseEvent: telemetryEnabled,
        // Steady runs move the page auto-pause past the window (by up to the margin).
        ...(measurement != undefined && {
          autoPauseTimeoutMs: OVERHEAD_DURATION_MARGIN_MS + AUTO_PAUSE_TIMEOUT_MS,
        }),
      });
    }
    // Let the next 1 Hz publish land (final gauges/counters), then drain everything.
    await delay(PUBLISH_SETTLE_MS);
    await drainUntilEmpty(drainer);
    endMonotonicTs = await pageNow(page);
    crossOriginIsolated = await page.evaluate(() => globalThis.crossOriginIsolated);
    if (measurement?.mode === "steady") {
      overheadPageState = await readOverheadPageState(page, { telemetryEnabled });
    }
    // After all measurement: a pure read of the page's scenario metadata.
    scenarioDescriptor = await describeScenario(page);
  } catch (error) {
    // Let a crash event / process-gone record racing this error land, then collect them.
    await delay(RUNNER_EVENT_GRACE_MS);
    const runnerEvents = await crashDetection.stop();
    if (runnerEvents.length === 0) {
      throw error;
    }
    // Partial result: everything sampled until the failure, stamped with the runner clock.
    const partialRun = buildRun({ endMonotonicTs: runnerNow(), environment: target.describe() });
    throw runnerEventsFailure(buildResult(partialRun, runnerEvents), error) ?? error;
  }

  // Measurement is over: the runner starts closing (later crash/process events are its own).
  const runnerEvents = await crashDetection.stop();
  const builtResult: BenchmarkResultV1 = buildResult(
    {
      ...buildRun({
        endMonotonicTs,
        environment: { ...target.describe(), crossOriginIsolated },
      }),
      scenario: scenarioDescriptor,
    },
    runnerEvents,
  );
  const result =
    measurement?.mode === "steady" && steadyRecording != undefined
      ? withOverheadFields(builtResult, {
          recording: steadyRecording,
          measurement,
          pageState: overheadPageState,
          hostSamples,
          pageRecords: drainer.records,
        })
      : builtResult;

  const legacy: BenchmarkArtifact = {
    scenarioId: scenario.scenarioId,
    pipeline: scenario.pipeline,
    startedAt: startedAtWall,
    finishedAt: finishedAtWall,
    memorySamples,
    // Snapshot: `recordFrameTimes` keeps pushing while the `end` screenshot below is taken.
    frameTimeSamples: frameTimeSamples.slice(),
  };

  // After the final drain, `endMonotonicTs` and the built result: nothing below is measured.
  await screenshotter?.capture("end");

  // Guard: a crash, gone process or reload during the run. Unlike the error-boundary guard below,
  // the v1 result (with `runnerEvents`) is written first as evidence.
  const crashFailure = runnerEventsFailure(result);
  if (crashFailure != undefined) {
    throw crashFailure;
  }

  // Guard: panels (or the app) that crashed into an error boundary mean the run measured an error
  // screen (e.g. "Error creating WebGL context." in 3D panels). Fail before the spec writes any
  // artifact; the screenshots taken so far are already attached to the report. Boundaries stay
  // rendered until dismissed, so one check after measurement catches crashes from any point of
  // the run.
  const errorBoundaryFailure = formatErrorBoundaryFailure({
    label,
    hits: await page.evaluate(collectErrorBoundaryHits, ERROR_BOUNDARY_TITLES),
  });
  if (errorBoundaryFailure != undefined) {
    throw new Error(errorBoundaryFailure);
  }

  console.debug(
    `[runScenario] ${label} done: ${memorySamples.length} host polls, ${drainer.records.length} telemetry records`,
  );
  return {
    legacy,
    result,
    runTimestamp,
    screenshots: screenshotter?.captured() ?? [],
    ...(toggleRecording != undefined && {
      toggle: { ...toggleRecording, records: drainer.records },
    }),
  };
}
