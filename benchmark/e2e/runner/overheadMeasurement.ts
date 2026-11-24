// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Page } from "@playwright/test";

import { nodeMonotonicNow, syncPageClock, toPageClock } from "./clockSync";
import {
  CLOCK_SYNC_ROUNDS,
  OVERHEAD_DRAIN_INTERVAL_MS,
  OVERHEAD_DURATION_MARGIN_MS,
  OVERHEAD_PROFILE_SAMPLING_INTERVAL_US,
  SAMPLE_INTERVAL_MS,
} from "./constants";
import { captureMainThreadProfile } from "./cpuProfile";
import { collectElectronMainProcessMetrics } from "./electronHostCollector";
import { installMainThreadProbe, readMainThreadProbe } from "./mainThreadProbe";
import type {
  OverheadMeasurement,
  OverheadRunData,
  OverheadWindowRecording,
  TimedToggleRecording,
} from "./overheadMeasurement.types";
import { readOverheadPageState, withOverheadFields } from "./overheadPage";
import type { OverheadPageState } from "./overheadPage.types";
import { SYSTEM_CLOCK, sampleSteadyWindow, steadyScenarioDurationMs } from "./steadyWindow";
import type { SteadyWindowRecording } from "./steadyWindow.types";
import { TelemetryDrainer, drainUntilEmpty, pageNow } from "./telemetryDrainer";
import { toggleScenarioDurationMs } from "./toggleBlocks";
import { sampleToggleWindow } from "./toggleWindow";
import type {
  BenchmarkTarget,
  HostMetricsSnapshot,
  SteadyMeasurement,
  ToggleMeasurement,
} from "./types";
import type { FrameProbeToggleRequest, LichtblickTelemetryWindow } from "../../src/telemetry/types";
import type { BenchmarkResultV1 } from "../result/schemaV1";
import type { ScenarioUnderTest } from "../types";

/*
 * Overhead A/B parts of `runScenario` (`options.measurement`); normal scenario runs never reach
 * this module.
 *
 * Steady mode (`measurement.mode = "steady"`, see `runner/steadyWindow.ts`): instead of the
 * deadline-driven window, `warmupMs` of 1 Hz host polls then a priming poll and exactly `polls`
 * polls on a fixed schedule. Those polls make no page call (stamped from the Node clock with a
 * once-measured page clock offset; Electron host metrics read in the main process); telemetry is
 * drained by a separate sequential loop and the main-thread probe (`runner/mainThreadProbe.ts`,
 * installed before navigation) is read before and after the window, so a busy renderer cannot
 * delay a poll. A scenario's page auto-pause is moved past the window; no screenshots. The
 * result gets `summary.steadyWindow`, `run.environment.collectors` and, with telemetry on,
 * `summary.telemetrySelf` (`runner/overheadPage.ts`).
 *
 * Toggle A/B mode (`measurement.mode = "toggle"`, see `runner/toggleWindow.ts`): telemetry is
 * installed on and switched off / on in-page per block (or, with `toggled: "frameProbe"` and
 * telemetry off, only the bare frame loop); CPU comes from the target's cumulative
 * process CPU time (`readCumulativeCpu`). No probe, no screenshots, auto-pause moved past the last
 * block. The blocks and the drained records are returned as `toggle`; the v1 result (`run.mode`
 * "overhead", no steady window) is not meant to be written.
 */

/**
 * Page auto-pause duration of an overhead A/B run (steady window or toggle blocks) plus
 * `OVERHEAD_DURATION_MARGIN_MS`. Undefined for normal runs and scenarios without auto-pause.
 */
export function measurementAutoPauseMs(
  scenario: ScenarioUnderTest,
  measurement: OverheadMeasurement | undefined,
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

/** Before the scenario page loads: the steady window's main-thread probe (same in every arm). */
export async function prepareOverheadPage(
  page: Page,
  measurement: OverheadMeasurement,
): Promise<void> {
  if (measurement.mode === "steady") {
    await installMainThreadProbe(page);
  }
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
}): Promise<TimedToggleRecording> {
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
 * The fixed-schedule window of an overhead A/B run (instead of the deadline-driven scenario window):
 * the steady window or the toggle blocks.
 */
export async function recordOverheadWindow({
  target,
  measurement,
  drainer,
  onHostSnapshot,
}: {
  target: BenchmarkTarget;
  measurement: OverheadMeasurement;
  drainer: TelemetryDrainer;
  onHostSnapshot: (host: HostMetricsSnapshot) => void;
}): Promise<OverheadWindowRecording> {
  if (measurement.mode === "toggle") {
    return { toggleRecording: await recordToggleWindow({ target, measurement, drainer }) };
  }
  return {
    steadyRecording: await recordSteadyWindow({ target, measurement, drainer, onHostSnapshot }),
  };
}

/** End of the measured overhead window (steady window or last toggle block), if any. */
export function overheadWindowEndMonotonicTs({
  steadyRecording,
  toggleRecording,
}: OverheadWindowRecording): number | undefined {
  return steadyRecording?.endMonotonicTs ?? toggleRecording?.blocks.at(-1)?.endMonotonicTs;
}

/** After teardown: the steady run's page state (collectors, emit cost); none in toggle mode. */
export async function readOverheadState(
  page: Page,
  measurement: OverheadMeasurement,
  { telemetryEnabled }: { telemetryEnabled: boolean },
): Promise<OverheadPageState> {
  if (measurement.mode !== "steady") {
    return {};
  }
  return await readOverheadPageState(page, { telemetryEnabled });
}

/**
 * The v1 result of an overhead run: steady runs get `summary.steadyWindow`,
 * `run.environment.collectors` and (telemetry on) `summary.telemetrySelf`; toggle runs are unchanged.
 */
export function withOverheadResult(
  result: BenchmarkResultV1,
  { measurement, recording, pageState, hostSamples, pageRecords }: OverheadRunData,
): BenchmarkResultV1 {
  if (measurement.mode !== "steady" || recording.steadyRecording == undefined) {
    return result;
  }
  return withOverheadFields(result, {
    recording: recording.steadyRecording,
    measurement,
    pageState,
    hostSamples,
    pageRecords,
  });
}
