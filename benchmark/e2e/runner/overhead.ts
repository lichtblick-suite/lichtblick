// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { OVERHEAD_TARGETS } from "./constants";
import type { OverheadDeltas, OverheadReport, OverheadRunStats, OverheadTargets } from "./types";
import { OVERHEAD_PREFIX } from "../result/constants";
import type { BenchmarkPlatform, BenchmarkResultV1 } from "../result/schemaV1";

// Telemetry overhead A/B: the same scenario run with `?telemetry=off` and with telemetry
// on, compared on host process metrics (sum over all app processes per 1 Hz poll).
//
// - CPU: `cpuDeltaRelative = (onMedian - offMedian) / offMedian` of the median per-poll total CPU
//   (percent of one core summed over processes); target ≤ 0.02 (i.e. ≤ 2 % more CPU than off).
//   `cpuDeltaPctPoints = onMedian - offMedian` is reported alongside.
// - Memory: `memDeltaBytes = onMean - offMean` of the mean per-poll total working set; target
//   ≤ 20 MiB.
// Report only: targets are evaluated and written, but only gate when BENCHMARK_OVERHEAD_GATE=1.

export function overheadStatsFromResult(result: BenchmarkResultV1): OverheadRunStats {
  const { process } = result.summary;
  return {
    telemetryEnabled: result.run.telemetryEnabled,
    hostPolls: process.sampleCount,
    medianTotalCpuPercent: process.medianTotalCpuPercent,
    meanTotalWorkingSetBytes: process.meanTotalWorkingSetBytes,
    peakTotalWorkingSetBytes: process.peakTotalWorkingSetBytes,
  };
}

export function computeOverheadDeltas(off: OverheadRunStats, on: OverheadRunStats): OverheadDeltas {
  const cpuDeltaPctPoints = on.medianTotalCpuPercent - off.medianTotalCpuPercent;
  const deltas: OverheadDeltas = {
    cpuDeltaPctPoints,
    memDeltaBytes: on.meanTotalWorkingSetBytes - off.meanTotalWorkingSetBytes,
  };
  if (off.medianTotalCpuPercent > 0) {
    deltas.cpuDeltaRelative = cpuDeltaPctPoints / off.medianTotalCpuPercent;
  } else if (on.medianTotalCpuPercent <= 0) {
    deltas.cpuDeltaRelative = 0;
  }
  return deltas;
}

export function buildOverheadReport(input: {
  platform: BenchmarkPlatform;
  scenarioId: string;
  off: BenchmarkResultV1;
  on: BenchmarkResultV1;
  targets?: OverheadTargets;
  now?: Date;
}): OverheadReport {
  const targets = input.targets ?? { ...OVERHEAD_TARGETS };
  const off = overheadStatsFromResult(input.off);
  const on = overheadStatsFromResult(input.on);
  const deltas = computeOverheadDeltas(off, on);
  const within = {
    cpu:
      deltas.cpuDeltaRelative != undefined &&
      deltas.cpuDeltaRelative <= targets.cpuDeltaRelativeMax,
    memory: deltas.memDeltaBytes <= targets.memDeltaBytesMax,
  };
  return {
    schemaVersion: 1,
    kind: "overhead",
    platform: input.platform,
    scenarioId: input.scenarioId,
    createdAtWall: (input.now ?? new Date()).toISOString(),
    off,
    on,
    deltas,
    targets,
    withinTargets: within.cpu && within.memory,
    within,
  };
}

export function overheadFileName(
  platform: BenchmarkPlatform,
  scenarioId: string,
  timestamp: number,
): string {
  return `${OVERHEAD_PREFIX}${platform}-${scenarioId}-${timestamp}.json`;
}

/** True when the overhead targets should fail the test (`BENCHMARK_OVERHEAD_GATE=1`). */
export function isOverheadGateEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.BENCHMARK_OVERHEAD_GATE === "1";
}
