// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Page } from "@playwright/test";
import os from "node:os";
import { setTimeout as delay } from "node:timers/promises";

import { writeResultV1 } from "./artifacts";
import {
  CLOSE_EVENT_POLL_INTERVAL_MS,
  CLOSE_EVENT_TIMEOUT_MS,
  DEFAULT_SAMPLE_DURATION_MS,
  DRAIN_BATCH_SIZE,
  MAX_DRAINS_PER_TICK,
  MAX_TELEMETRY_DRAIN_ITERATIONS,
  AUTO_PAUSE_TIMEOUT_MS,
  PAUSE_CLICK_TIMEOUT_MS,
  PUBLISH_SETTLE_MS,
  RUNNER_EVENT_GRACE_MS,
  SAMPLE_INTERVAL_MS,
  SCREENSHOTS_DIR,
  ERROR_BOUNDARY_TITLES,
} from "./constants";
import { formatRunnerEventsFailure, runnerNow, startCrashDetection } from "./crashDetection";
import { collectErrorBoundaryHits, formatErrorBoundaryFailure } from "./errorBoundaries";
import type { RecordedFrameTime } from "./runScenario.types";
import { ScenarioScreenshotter, loadedEventName, resolveScreenshotMode } from "./screenshots";
import type {
  BenchmarkTarget,
  HostProcessSample,
  RunEnvironment,
  RunScenarioOptions,
  ScenarioRunResult,
} from "./types";
import type { LichtblickScenarioControlWindow } from "../../src/scenarios/scenarioControl";
import { TELEMETRY_OFF_VALUE, TELEMETRY_QUERY_PARAM } from "../../src/telemetry/constants";
import type { LichtblickTelemetryWindow } from "../../src/telemetry/types";
import {
  BenchmarkResultV1,
  ListenerDispatchSample,
  RunnerEvent,
  TelemetryBatch,
  TelemetryRecord,
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
    totalMemBytes: os.totalmem(),
  };
}

export function buildScenarioParams(
  scenario: ScenarioUnderTest,
  options: RunScenarioOptions,
): URLSearchParams {
  const params = new URLSearchParams({ scenario: scenario.scenarioId });
  if (options.telemetryEnabled === false) {
    params.set(TELEMETRY_QUERY_PARAM, TELEMETRY_OFF_VALUE);
  }
  if (scenario.usesMcapFixtures === true) {
    if (options.fixtureUrls == undefined || options.fixtureUrls.length === 0) {
      throw new Error(`Scenario ${scenario.scenarioId} needs MCAP fixture URLs`);
    }
    params.set("ds.url", options.fixtureUrls.join(","));
  }
  return params;
}

/** Page monotonic clock (`performance.timeOrigin + performance.now()`, same as telemetry). */
async function pageNow(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const api = (window as LichtblickTelemetryWindow).lichtblickTelemetry;
    return api != undefined ? api.now() : performance.timeOrigin + performance.now();
  });
}

class TelemetryDrainer {
  public readonly records: TelemetryRecord[] = [];
  public dropped = 0;
  public realm = "renderer";
  readonly #page: Page;

  public constructor(page: Page) {
    this.#page = page;
  }

  /** Drains up to `maxDrains` batches; returns the number of records received. */
  public async drain(maxDrains = MAX_DRAINS_PER_TICK): Promise<number> {
    let received = 0;
    for (let i = 0; i < maxDrains; i++) {
      const batch: TelemetryBatch | undefined = await this.#page.evaluate(
        (max) => (window as LichtblickTelemetryWindow).lichtblickTelemetry?.drain(max),
        DRAIN_BATCH_SIZE,
      );
      if (batch == undefined) {
        break;
      }
      this.realm = batch.realm;
      this.dropped += batch.dropped;
      for (const record of batch.records) {
        this.records.push(record);
      }
      received += batch.records.length;
      if (batch.records.length < DRAIN_BATCH_SIZE) {
        break;
      }
    }
    return received;
  }

  public hasEvent(name: string, phase: string): boolean {
    return this.records.some(
      (record) => record.kind === "event" && record.name === name && record.phase === phase,
    );
  }
}

/** Drains until no record is returned (bounded). */
async function drainUntilEmpty(drainer: TelemetryDrainer): Promise<void> {
  for (let i = 0; i < MAX_TELEMETRY_DRAIN_ITERATIONS; i++) {
    if ((await drainer.drain()) === 0) {
      return;
    }
  }
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
  { waitForCloseEvent }: { waitForCloseEvent: boolean },
): Promise<void> {
  const autoPaused =
    scenario.durationMs != undefined &&
    (await page
      .getByRole("button", { name: "Play", exact: true })
      .waitFor({ state: "visible", timeout: AUTO_PAUSE_TIMEOUT_MS })
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
 * Crash detection (`runner/crashDetection.ts`): listeners are attached before the first navigation
 * and reload detection is armed once the app is ready. A renderer crash, a gone Electron process or
 * an unexpected reload is recorded as `runnerEvents` in the v1 result; the run then **throws after
 * writing that result** (`writeResultV1`) so the evidence is kept. If such an event made the run
 * fail early (e.g. "Target crashed"), a partial result (whatever was sampled so far) is written.
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
        listenerDispatchSamples.push({
          monotonicTs: sample.monotonicTs,
          value: sample.value,
        });
      }
    }
  });

  const startedAtWall = new Date().toISOString();
  console.debug(`[runScenario] ${label} started ${startedAtWall}`);
  // Before the runner's own navigation: crashes are caught from the start, reloads once armed.
  const crashDetection = await startCrashDetection({ page, electronApp: target.electronApp });
  const drainer = new TelemetryDrainer(page);
  const durationMs = scenario.durationMs ?? DEFAULT_SAMPLE_DURATION_MS;
  const screenshotMode = resolveScreenshotMode({ requested: options.screenshots });
  let screenshotter: ScenarioScreenshotter | undefined;
  let startMonotonicTs: number | undefined;
  let windowEndMonotonicTs: number | undefined;
  let finishedAtWall: string | undefined;

  const buildResult = (end: {
    endMonotonicTs: number;
    environment: RunEnvironment;
    runnerEvents: readonly RunnerEvent[];
  }): BenchmarkResultV1 =>
    buildResultV1({
      run: {
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
        sampleIntervalMs: SAMPLE_INTERVAL_MS,
        environment: end.environment,
      },
      pageRecords: drainer.records,
      drainedDropped: drainer.dropped,
      drainRealm: drainer.realm,
      hostSamples,
      listenerDispatchSamples,
      runnerEvents: end.runnerEvents,
    });

  /** With runner events: writes the v1 result as evidence and returns the failure to throw. */
  const runnerEventsFailure = (result: BenchmarkResultV1, cause?: unknown): Error | undefined => {
    const events = result.runnerEvents ?? [];
    if (events.length === 0) {
      return undefined;
    }
    const resultPath = writeResultV1({ result, runTimestamp });
    return new Error(formatRunnerEventsFailure({ label, events, resultPath }), { cause });
  };

  let endMonotonicTs: number;
  let crossOriginIsolated: boolean;
  try {
    await page.goto(target.scenarioUrl(buildScenarioParams(scenario, options)));
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

    // When: 1 Hz loop - page clock → host metrics → drain. Ticks are timed and strictly
    // sequential (each starts after the previous one's wait).
    await repeatWhile(
      () => Date.now() < windowEnd,
      async () => {
        const tickStart = Date.now();
        const ts = await pageNow(page);
        const host = await target.collectHostMetrics(ts);
        hostSamples.push(...host.samples);
        memorySamples.push({
          timestampMs: Date.now(),
          metrics: host.legacyMetrics,
        });
        await drainer.drain();
        const remaining = Math.min(
          SAMPLE_INTERVAL_MS - (Date.now() - tickStart),
          windowEnd - Date.now(),
        );
        if (remaining > 0) {
          await delay(remaining);
        }
      },
    );
    finishedAtWall = new Date().toISOString();
    // End of the measured window (rates in `summary.pipeline`); teardown below is excluded.
    windowEndMonotonicTs = await pageNow(page);

    // A `loaded`/`mid` capture still in flight at the deadline finishes before teardown, so its page
    // round trips don't interleave with pause/close.
    await screenshotter?.settle();

    if (scenario.pipeline === "real") {
      await pauseAndCloseDataSource(page, scenario, drainer, {
        waitForCloseEvent: telemetryEnabled,
      });
    }
    // Let the next 1 Hz publish land (final gauges/counters), then drain everything.
    await delay(PUBLISH_SETTLE_MS);
    await drainUntilEmpty(drainer);
    endMonotonicTs = await pageNow(page);
    crossOriginIsolated = await page.evaluate(() => globalThis.crossOriginIsolated);
  } catch (error) {
    // Let a crash event / process-gone record racing this error land, then collect them.
    await delay(RUNNER_EVENT_GRACE_MS);
    const runnerEvents = await crashDetection.stop();
    if (runnerEvents.length === 0) {
      throw error;
    }
    // Partial result: everything sampled until the failure, stamped with the runner clock.
    throw (
      runnerEventsFailure(
        buildResult({ endMonotonicTs: runnerNow(), environment: target.describe(), runnerEvents }),
        error,
      ) ?? error
    );
  }

  // Measurement is over: the runner starts closing (later crash/process events are its own).
  const runnerEvents = await crashDetection.stop();
  const result = buildResult({
    endMonotonicTs,
    environment: { ...target.describe(), crossOriginIsolated },
    runnerEvents,
  });

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
  };
}
