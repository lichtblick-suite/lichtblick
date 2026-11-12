// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { OVERHEAD_COMPARISONS, OVERHEAD_TARGETS } from "./constants";
import type {
  BuildOverheadReportInput,
  OverheadComparison,
  OverheadComparisonSummary,
  OverheadExclusionReason,
  OverheadMetrics,
  OverheadPair,
  OverheadPairDeltas,
  OverheadPairFlag,
  OverheadMethod,
  OverheadReportV3,
  OverheadRunInput,
  OverheadRunV2,
  OverheadSelfCostSummary,
  OverheadTargets,
  OverheadVerdicts,
} from "./overhead.types";
import type { OverheadToggleSummaryV3 } from "./toggleBlocks.types";
import { OVERHEAD_METRIC_KEYS, OVERHEAD_PREFIX } from "../result/constants";
import type { BenchmarkPlatform } from "../result/schemaV1";
import { median, summarizeMetric, verdict, worstVerdict } from "../result/stats";
import { hasWorkingSet } from "../result/steadyWindow";
import type { TelemetrySelfSummaryV1 } from "../result/telemetrySelf.types";
import { compareCodeUnits } from "../shared/compare";

// Telemetry overhead A/B, relaunch method (the relaunch fields of the schema-3 report): the same
// scenario in fresh app instances with `?telemetry=off`
// and with telemetry on (optionally also on without the UA memory probe), `repeats` times in a
// balanced order (`runner/overheadSchedule.ts`). Each run measures a fixed-schedule steady window
// (`summary.steadyWindow`). Per repeat, each comparison yields one pair of deltas (treatment − base):
//
// - CPU: `cpuRelative = (on − off) / off` of the steady median per-poll total CPU (per-core sum),
//   `cpuPctPoints = on − off`; target `cpuRelative ≤ 0.02`.
// - Memory: `memBytes = on − off` of the steady mean per-poll total working set; target ≤ 20 MiB
//   (absent for a pair whose runs measured no working set, so memory is then not measured).
//   `memBytesCommonProcesses` restricts it to the process types both runs had.
// - Main thread (runner probe, both arms): long-task blocked ms/s and fps deltas.
//
// Pairs with a window mismatch in either run are excluded; a process-set mismatch is flagged. Each
// metric is summarized as median, IQR and exact order-statistic CI95 of the median over the included
// pairs (`summarizeMetric`), and CPU/memory get a tri-state verdict (`within` / `exceeds` / `inconclusive`, see
// `verdict`). Report only, unless `BENCHMARK_OVERHEAD_GATE=1` (then an overall `exceeds` fails).
//
// Schema 3 adds the in-process toggle A/B (`runner/toggleBlocks.ts`, one launch, ABBA blocks of
// telemetry off / on, CPU from cumulative process CPU time) and `BENCHMARK_OVERHEAD_METHOD`: the
// CPU verdict comes from toggle (methods `toggle`, `both`) or relaunch, the memory verdict only
// from relaunch (toggling cannot measure retained memory; `notMeasured` for method `toggle`). On
// web with `BENCHMARK_OVERHEAD_UA_ARM=1`, a second toggle launch without the UA memory probe
// (`toggleWithoutUaProbe`) isolates the probe's share of the toggle CPU delta. With
// `BENCHMARK_OVERHEAD_FRAME_PROBE_ARM=1`, a launch with telemetry off toggles only the benchmark FPS
// probe's frame loop (`toggleFrameProbe`, harness, not shipped). Both arms, like the `on-noUa`
// relaunch sections and the adjacent-pair deltas, are diagnostic: optional (off by default) and
// never part of a verdict. The
// toggle launch ends with a profiled period (`directAttribution`, `result/directAttribution.ts`):
// renderer main-thread JS time in telemetry sources, with its own "direct (JS only)" verdict that
// is never merged into `verdicts`.

/** A measured run of the report from its v1 result; throws without `summary.steadyWindow`. */
export function overheadRunFromResult({ result, ...meta }: OverheadRunInput): OverheadRunV2 {
  const steadyWindow = result.summary.steadyWindow;
  if (steadyWindow == undefined) {
    throw new Error(`Overhead run ${meta.arm}/${meta.repeat} has no summary.steadyWindow`);
  }
  const { mainThread, ...steady } = steadyWindow;
  const { telemetrySelf } = result.summary;
  const { collectors } = result.run.environment;
  return {
    ...meta,
    telemetryEnabled: result.run.telemetryEnabled,
    steady,
    ...(mainThread != undefined && { mainThread }),
    ...(telemetrySelf != undefined && { telemetrySelf }),
    ...(collectors != undefined && { collectors }),
  };
}

/** Same process types with the same (max) counts. */
function processSetsMatch(a: Record<string, number>, b: Record<string, number>): boolean {
  const keysA = Object.keys(a).sort(compareCodeUnits);
  const keysB = Object.keys(b).sort(compareCodeUnits);
  return (
    keysA.length === keysB.length &&
    keysA.every((key, index) => key === keysB[index] && a[key] === b[key])
  );
}

/** Treatment − base mean working set over the process types present in both runs. */
function commonProcessMemDelta(base: OverheadRunV2, treatment: OverheadRunV2): number {
  const baseByType = base.steady.meanWorkingSetBytesByType;
  const treatmentByType = treatment.steady.meanWorkingSetBytesByType;
  let delta = 0;
  for (const [type, bytes] of Object.entries(treatmentByType)) {
    const baseBytes = baseByType[type];
    if (baseBytes != undefined) {
      delta += bytes - baseBytes;
    }
  }
  return delta;
}

/** `(treatment − base) / base`; 0 when both are 0, undefined for a 0 base only. */
function relativeDelta(base: number, treatment: number): number | undefined {
  if (base > 0) {
    return (treatment - base) / base;
  }
  return treatment <= 0 ? 0 : undefined;
}

/**
 * Deltas of one pair (treatment − base), see the module comment. The memory deltas are absent when
 * either run has no working-set poll (memory not measured, e.g. `ps` failed), so they drop out of
 * the memory statistics instead of counting as a 0 delta.
 */
export function computeOverheadDeltas(
  base: OverheadRunV2,
  treatment: OverheadRunV2,
): OverheadPairDeltas {
  const baseCpu = base.steady.medianTotalCpuPercent;
  const treatmentCpu = treatment.steady.medianTotalCpuPercent;
  const cpuRelative = relativeDelta(baseCpu, treatmentCpu);
  const deltas: OverheadPairDeltas = {
    ...(cpuRelative != undefined && { cpuRelative }),
    cpuPctPoints: treatmentCpu - baseCpu,
    ...(hasWorkingSet(base.steady) &&
      hasWorkingSet(treatment.steady) && {
        memBytes: treatment.steady.meanTotalWorkingSetBytes - base.steady.meanTotalWorkingSetBytes,
        memBytesCommonProcesses: commonProcessMemDelta(base, treatment),
      }),
  };
  if (base.mainThread != undefined && treatment.mainThread != undefined) {
    deltas.mainThreadBlockedMsPerSec =
      treatment.mainThread.longTaskBlockedMsPerSec - base.mainThread.longTaskBlockedMsPerSec;
    deltas.fps = treatment.mainThread.fps - base.mainThread.fps;
  }
  return deltas;
}

/** One pair of a comparison in one repeat: deltas, exclusion reasons and flags. */
export function buildOverheadPair(
  comparison: OverheadComparison,
  base: OverheadRunV2,
  treatment: OverheadRunV2,
): OverheadPair {
  const reasons: OverheadExclusionReason[] = [];
  if (base.steady.windowMismatch) {
    reasons.push("baseWindowMismatch");
  }
  if (treatment.steady.windowMismatch) {
    reasons.push("treatmentWindowMismatch");
  }
  const flags: OverheadPairFlag[] = processSetsMatch(
    base.steady.processSet,
    treatment.steady.processSet,
  )
    ? []
    : ["processSetMismatch"];
  return {
    comparison,
    repeat: base.repeat,
    order: base.order < treatment.order ? "off-first" : "on-first",
    baseArm: base.arm,
    treatmentArm: treatment.arm,
    deltas: computeOverheadDeltas(base, treatment),
    excluded: reasons.length > 0,
    reasons,
    flags,
  };
}

/** Pairs of every comparison whose arms both ran, per repeat (repeats missing an arm are skipped). */
export function buildOverheadPairs(runs: readonly OverheadRunV2[]): OverheadPair[] {
  const byRepeat = new Map<number, OverheadRunV2[]>();
  for (const run of runs) {
    byRepeat.set(run.repeat, [...(byRepeat.get(run.repeat) ?? []), run]);
  }
  const pairs: OverheadPair[] = [];
  const repeats = [...byRepeat.keys()].sort((a, b) => a - b);
  for (const [comparison, { base, treatment }] of Object.entries(OVERHEAD_COMPARISONS)) {
    for (const repeat of repeats) {
      const repeatRuns = byRepeat.get(repeat)!;
      const baseRun = repeatRuns.find((run) => run.arm === base);
      const treatmentRun = repeatRuns.find((run) => run.arm === treatment);
      if (baseRun != undefined && treatmentRun != undefined) {
        pairs.push(buildOverheadPair(comparison as OverheadComparison, baseRun, treatmentRun));
      }
    }
  }
  return pairs;
}

/** Median / IQR / CI95 of each delta over the included pairs of `comparison`. */
export function summarizeComparison(
  pairs: readonly OverheadPair[],
  comparison: OverheadComparison,
): OverheadComparisonSummary {
  const ofComparison = pairs.filter((pair) => pair.comparison === comparison);
  const included = ofComparison.filter((pair) => !pair.excluded);
  const metrics = Object.fromEntries(
    OVERHEAD_METRIC_KEYS.map((key) => [
      key,
      summarizeMetric(included.map((pair) => pair.deltas[key])),
    ]),
  ) as OverheadMetrics;
  return {
    n: included.length,
    excludedPairs: ofComparison.length - included.length,
    processSetMismatches: included.filter((pair) => pair.flags.includes("processSetMismatch"))
      .length,
    metrics,
  };
}

/** CPU (`cpuRelative`) and memory (`memBytes`) CI95 against the targets; overall = worst. */
export function overheadVerdicts(
  metrics: OverheadMetrics,
  targets: OverheadTargets,
): OverheadVerdicts {
  const cpu = verdict(metrics.cpuRelative.ci95, targets.cpuDeltaRelativeMax, metrics.cpuRelative.n);
  const memory = verdict(metrics.memBytes.ci95, targets.memDeltaBytesMax, metrics.memBytes.n);
  return { cpu, memory, overall: worstVerdict([cpu, memory]) };
}

function medianOf(
  selves: readonly TelemetrySelfSummaryV1[],
  pick: (self: TelemetrySelfSummaryV1) => number | undefined,
): number | undefined {
  return median(selves.map(pick).filter((value): value is number => value != undefined));
}

/** Medians of the `on` arm's in-page self-cost; undefined when no run reported it. */
export function summarizeSelfCost(
  runs: readonly OverheadRunV2[],
): OverheadSelfCostSummary | undefined {
  const selves = runs
    .filter((run) => run.arm === "on")
    .flatMap((run) => (run.telemetrySelf != undefined ? [run.telemetrySelf] : []));
  if (selves.length === 0) {
    return undefined;
  }
  const meanEmitNs = medianOf(selves, (self) => self.meanEmitNs);
  const estimatedEmitMsPerSec = medianOf(selves, (self) => self.estimatedEmitMsPerSec);
  const uaResolved = medianOf(selves, (self) => self.uaResolved);
  const uaFailures = medianOf(selves, (self) => self.uaFailures);
  const uaResolveMsMean = medianOf(selves, (self) => self.uaResolveMsMean);
  return {
    n: selves.length,
    msPerSec: medianOf(selves, (self) => self.msPerSec.total)!,
    fractionOfCore: medianOf(selves, (self) => self.fractionOfCore)!,
    recordsPerSec: medianOf(selves, (self) => self.recordsPerSec)!,
    ...(meanEmitNs != undefined && { meanEmitNs }),
    ...(estimatedEmitMsPerSec != undefined && { estimatedEmitMsPerSec }),
    uaCalls: medianOf(selves, (self) => self.uaCalls)!,
    ...(uaResolved != undefined && { uaResolved }),
    ...(uaFailures != undefined && { uaFailures }),
    ...(uaResolveMsMean != undefined && { uaResolveMsMean }),
  };
}

/** Optional UA-probe comparisons (only when the `on-noUa` arm ran). */
function uaComparisons(
  pairs: readonly OverheadPair[],
  targets: OverheadTargets,
): Pick<OverheadReportV3, "withoutUaProbe" | "uaCost"> {
  if (!pairs.some((pair) => pair.treatmentArm === "on-noUa" || pair.baseArm === "on-noUa")) {
    return {};
  }
  const withoutUaProbe = summarizeComparison(pairs, "onNoUa-vs-off");
  return {
    withoutUaProbe: {
      ...withoutUaProbe,
      verdicts: overheadVerdicts(withoutUaProbe.metrics, targets),
    },
    uaCost: summarizeComparison(pairs, "on-vs-onNoUa"),
  };
}

/**
 * Final verdicts of a schema-3 report and their sources: `relaunch` → both from the relaunch A/B;
 * `toggle` → CPU from the toggle A/B, memory not measured (overall = CPU); `both` → CPU from toggle,
 * memory from relaunch, overall = the worse. Throws when a method's toggle summary is missing.
 */
export function overheadFinalVerdicts({
  method,
  relaunchVerdicts,
  toggle,
}: {
  method: OverheadMethod;
  relaunchVerdicts: OverheadVerdicts;
  toggle: Pick<OverheadToggleSummaryV3, "verdict"> | undefined;
}): Pick<OverheadReportV3, "verdicts" | "cpuVerdictSource" | "memVerdictSource"> {
  if (method === "relaunch") {
    return {
      verdicts: relaunchVerdicts,
      cpuVerdictSource: "relaunch",
      memVerdictSource: "relaunch",
    };
  }
  if (toggle == undefined) {
    throw new Error(`Overhead method ${method} needs the toggle A/B summary`);
  }
  const cpu = toggle.verdict;
  if (method === "toggle") {
    return {
      verdicts: { cpu, overall: cpu },
      cpuVerdictSource: "toggle",
      memVerdictSource: "notMeasured",
    };
  }
  const memory = relaunchVerdicts.memory;
  return {
    verdicts: { cpu, memory, overall: worstVerdict([cpu, memory]) },
    cpuVerdictSource: "toggle",
    memVerdictSource: "relaunch",
  };
}

/**
 * The schema-3 overhead report of one scenario on one platform (pure): the relaunch A/B of `runs`
 * (relaunch fields; none for method `toggle`), the toggle A/B summary (methods `toggle` / `both`)
 * and the final verdicts (`overheadFinalVerdicts`).
 */
export function buildOverheadReport(input: BuildOverheadReportInput): OverheadReportV3 {
  const method = input.method ?? "relaunch";
  const targets = input.targets ?? { ...OVERHEAD_TARGETS };
  const runs = input.runs.map(overheadRunFromResult);
  const pairs = buildOverheadPairs(runs);
  const main = summarizeComparison(pairs, "on-vs-off");
  const selfCost = summarizeSelfCost(runs);
  const relaunchVerdicts = overheadVerdicts(main.metrics, targets);
  const { toggle, toggleWithoutUaProbe, toggleFrameProbe, directAttribution } = input;
  return {
    schemaVersion: 3,
    kind: "overhead",
    platform: input.platform,
    scenarioId: input.scenarioId,
    createdAtWall: (input.now ?? new Date()).toISOString(),
    method,
    config: { ...input.config, method, ...(toggle != undefined && { toggle: toggle.config }) },
    runs,
    pairs,
    ...main,
    windowMismatchRuns: runs.filter((run) => run.steady.windowMismatch).length,
    ...overheadFinalVerdicts({ method, relaunchVerdicts, toggle }),
    ...(method !== "toggle" && { relaunchVerdicts }),
    ...(toggle != undefined && { toggle }),
    ...(toggle != undefined && toggleWithoutUaProbe != undefined && { toggleWithoutUaProbe }),
    ...(toggle != undefined && toggleFrameProbe != undefined && { toggleFrameProbe }),
    ...(toggle != undefined && directAttribution != undefined && { directAttribution }),
    ...uaComparisons(pairs, targets),
    ...(selfCost != undefined && { selfCost }),
    targets,
  };
}

export function overheadFileName(
  platform: BenchmarkPlatform,
  scenarioId: string,
  timestamp: number,
): string {
  return `${OVERHEAD_PREFIX}${platform}-${scenarioId}-${timestamp}.json`;
}
