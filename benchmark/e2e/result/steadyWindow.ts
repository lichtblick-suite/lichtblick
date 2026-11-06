// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Steady-window statistics of overhead A/B runs (`summary.steadyWindow`, see `SteadyWindowSummaryV1`).
// Free of DOM/Playwright/Node imports (compiled by the root tsconfig too).

import { MS_PER_SECOND } from "./constants";
import type { HostProcessSample } from "./schemaV1";
import { maxOf, mean, median } from "./stats";
import type {
  MainThreadProbeReading,
  MainThreadRatesV1,
  PollTotals,
  SteadyWindowInput,
  SteadyWindowSummaryV1,
} from "./steadyWindow.types";
import { compareCodeUnits } from "../shared/compare";

/** Whether a steady window measured memory (at least one poll with a working set). */
export function hasWorkingSet(
  steady: Pick<SteadyWindowSummaryV1, "meanWorkingSetBytesByType">,
): boolean {
  return Object.keys(steady.meanWorkingSetBytesByType).length > 0;
}

/** Long-task ms/s and FPS between two probe readings; undefined for a non-positive interval. */
export function mainThreadRates(
  start: MainThreadProbeReading | undefined,
  end: MainThreadProbeReading | undefined,
): MainThreadRatesV1 | undefined {
  if (start == undefined || end == undefined) {
    return undefined;
  }
  const seconds = (end.nowMs - start.nowMs) / MS_PER_SECOND;
  if (!(seconds > 0)) {
    return undefined;
  }
  return {
    longTaskBlockedMsPerSec: Math.max(0, end.longTaskMs - start.longTaskMs) / seconds,
    fps: Math.max(0, end.frames - start.frames) / seconds,
  };
}

function addSample(totals: PollTotals, sample: HostProcessSample): void {
  const type = sample.processType;
  totals.countByType.set(type, (totals.countByType.get(type) ?? 0) + 1);
  if (sample.workingSetBytes != undefined) {
    totals.ws += sample.workingSetBytes;
    totals.hasWs = true;
    totals.wsByType.set(type, (totals.wsByType.get(type) ?? 0) + sample.workingSetBytes);
  }
  if (sample.cpuPercent != undefined) {
    totals.cpu += sample.cpuPercent;
    totals.hasCpu = true;
  }
}

/** Per-poll totals of the samples stamped with one of `pollTimestamps` (other polls ignored). */
function pollTotals(
  hostSamples: readonly HostProcessSample[],
  pollTimestamps: readonly number[],
): PollTotals[] {
  const byTs = new Map<number, PollTotals>();
  for (const ts of pollTimestamps) {
    byTs.set(ts, {
      ws: 0,
      hasWs: false,
      cpu: 0,
      hasCpu: false,
      wsByType: new Map(),
      countByType: new Map(),
    });
  }
  for (const sample of hostSamples) {
    const totals = byTs.get(sample.monotonicTs);
    if (totals != undefined) {
      addSample(totals, sample);
    }
  }
  return [...byTs.values()].filter((totals) => totals.countByType.size > 0);
}

/** Mean per-poll working set per type over the polls with memory (absent type = 0 in a poll). */
function meanWorkingSetByType(polls: readonly PollTotals[]): Record<string, number> {
  const withWs = polls.filter((poll) => poll.hasWs);
  const sums = new Map<string, number>();
  for (const poll of withWs) {
    for (const [type, ws] of poll.wsByType) {
      sums.set(type, (sums.get(type) ?? 0) + ws);
    }
  }
  const types = [...sums.keys()].sort(compareCodeUnits);
  return Object.fromEntries(types.map((type) => [type, sums.get(type)! / withWs.length]));
}

/** Highest process count per type in any one poll. */
function processSetOf(polls: readonly PollTotals[]): Record<string, number> {
  const maxCounts = new Map<string, number>();
  for (const poll of polls) {
    for (const [type, count] of poll.countByType) {
      maxCounts.set(type, Math.max(maxCounts.get(type) ?? 0, count));
    }
  }
  const types = [...maxCounts.keys()].sort(compareCodeUnits);
  return Object.fromEntries(types.map((type) => [type, maxCounts.get(type)!]));
}

/**
 * Host process statistics over the steady polls (`input.pollTimestamps`) of an overhead A/B run.
 * A window with fewer polls than requested, a poll without CPU or any overrun is a
 * `windowMismatch`. Without any working-set poll the memory totals are 0 and
 * `meanWorkingSetBytesByType` is empty: memory not measured (see `hasWorkingSet`).
 */
export function summarizeSteadyWindow(input: SteadyWindowInput): SteadyWindowSummaryV1 {
  const polls = pollTotals(input.hostSamples, input.pollTimestamps);
  const cpu = polls.filter((poll) => poll.hasCpu).map((poll) => poll.cpu);
  const ws = polls.filter((poll) => poll.hasWs).map((poll) => poll.ws);
  const mainThread = mainThreadRates(input.mainThreadStart, input.mainThreadEnd);
  return {
    warmupMs: input.warmupMs,
    requestedPolls: input.requestedPolls,
    polls: polls.length,
    overruns: input.overruns,
    windowMismatch:
      polls.length < input.requestedPolls || cpu.length < polls.length || input.overruns > 0,
    ...(input.maxPollLatencyMs != undefined && { maxPollLatencyMs: input.maxPollLatencyMs }),
    ...(input.clockSyncRttMs != undefined && { clockSyncRttMs: input.clockSyncRttMs }),
    startMonotonicTs: input.startMonotonicTs,
    endMonotonicTs: input.endMonotonicTs,
    medianTotalCpuPercent: median(cpu) ?? 0,
    meanTotalCpuPercent: mean(cpu) ?? 0,
    meanTotalWorkingSetBytes: mean(ws) ?? 0,
    peakTotalWorkingSetBytes: maxOf(ws) ?? 0,
    meanWorkingSetBytesByType: meanWorkingSetByType(polls),
    processSet: processSetOf(polls),
    ...(mainThread != undefined && { mainThread }),
  };
}
