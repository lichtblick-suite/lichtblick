// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Plain-text formatting of overhead A/B reports (schema 3), shared by the
// HTML report and the CI markdown summary. Free of DOM/Playwright/Node imports.

import { MEM_NOT_MEASURED, NONE, TOGGLE_UNTOGGLED_REALMS_NOTE, VERDICT_DISPLAY } from "./constants";
import type { CpuVerdictStats } from "./overheadText.types";
import type { DeltaUnit } from "./types";
import { RENDERER_REALM, RUNNER_REALM } from "../result/constants";
import type { DirectAttributionV3 } from "../result/directAttribution.types";
import type { MetricStats, Verdict } from "../result/stats.types";
import type {
  OverheadComparisonSummary,
  OverheadReport,
  OverheadSelfCostSummary,
} from "../runner/overhead.types";
import { toggleProcessTypeDeltas } from "../runner/toggleBlocks";
import type { OverheadToggleSummaryV3 } from "../runner/toggleBlocks.types";

/** `+1.0` / `-1.0` (`0.0` unsigned). */
export function signedText(value: number, digits: number): string {
  const text = value.toFixed(digits);
  return value > 0 && Number(text) !== 0 ? `+${text}` : text;
}

/**
 * Median with its CI95 when the stats carry one (`summarizeMetric`: from `MIN_PAIRS_FOR_VERDICT`
 * samples on): `+1.00 % [+0.50, +1.50]`; the median alone otherwise; `—` without a median.
 */
export function deltaText(stats: MetricStats | undefined, unit: DeltaUnit): string {
  if (stats?.median == undefined) {
    return NONE;
  }
  const scaled = (value: number) => signedText(value / unit.divisor, unit.digits);
  const median = `${scaled(stats.median)}${unit.suffix}`;
  if (stats.ci95 == undefined || stats.n < 2) {
    return median;
  }
  return `${median} [${scaled(stats.ci95.lower)}, ${scaled(stats.ci95.upper)}]`;
}

/** Interquartile range of the pair deltas (`—` with fewer than 2 pairs). */
export function iqrText(stats: MetricStats | undefined, unit: DeltaUnit): string {
  if (stats?.iqr == undefined || stats.n < 2) {
    return NONE;
  }
  return `${(stats.iqr / unit.divisor).toFixed(unit.digits)}${unit.suffix}`;
}

export function verdictText(verdict: Verdict): string {
  const display = VERDICT_DISPLAY[verdict];
  return `${display.symbol} ${display.label}`;
}

/** Included relaunch pairs, with the excluded count: `5 (1 excl.)`. */
export function pairsText(report: Pick<OverheadReport, "n" | "excludedPairs">): string {
  return report.excludedPairs > 0 ? `${report.n} (${report.excludedPairs} excl.)` : `${report.n}`;
}

/**
 * The units behind a CPU verdict: relaunch pairs as `pairsText` (`5 (1 excl.)`), toggle ABBA
 * quartets with their unit (`10 quartets (1 excl.)`).
 */
export function cpuSamplesText(cpu: CpuVerdictStats): string {
  if (cpu.source === "relaunch") {
    return pairsText({ n: cpu.n, excludedPairs: cpu.excluded });
  }
  const quartets = `${cpu.n} quartet${cpu.n === 1 ? "" : "s"}`;
  return cpu.excluded > 0 ? `${quartets} (${cpu.excluded} excl.)` : quartets;
}

/** The statistics behind a report's CPU verdict: the toggle A/B, else the relaunch A/B. */
export function cpuVerdictStats(report: OverheadReport): CpuVerdictStats {
  const { toggle } = report;
  if (report.cpuVerdictSource === "toggle" && toggle != undefined) {
    return toggleCpuStats(toggle);
  }
  return {
    source: "relaunch",
    n: report.n,
    excluded: report.excludedPairs,
    cpuRelative: report.metrics.cpuRelative,
    cpuPctPoints: report.metrics.cpuPctPoints,
  };
}

/**
 * Telemetry realms the toggle does not switch, sorted: every realm other than the renderer (whose
 * collectors the toggle pauses) and the runner that stamped records into a block. Worker sinks
 * (`worker:<n>`) are installed at worker start and record in both arms; their batches are dropped
 * in off blocks, so they show up in on blocks only.
 */
export function toggleUntoggledRealms(toggle: Pick<OverheadToggleSummaryV3, "blocks">): string[] {
  const realms = new Set<string>();
  for (const block of toggle.blocks) {
    for (const realm of Object.keys(block.recordsByRealm)) {
      if (realm !== RENDERER_REALM && realm !== RUNNER_REALM) {
        realms.add(realm);
      }
    }
  }
  return [...realms].sort();
}

/**
 * The note next to a report's CPU verdict when it comes from a toggle A/B that left realms
 * untoggled (`TOGGLE_UNTOGGLED_REALMS_NOTE`), else `undefined`.
 */
export function toggleCoverageNote(report: OverheadReport): string | undefined {
  const { toggle } = report;
  if (report.cpuVerdictSource !== "toggle" || toggle == undefined) {
    return undefined;
  }
  return toggleUntoggledRealms(toggle).length > 0 ? TOGGLE_UNTOGGLED_REALMS_NOTE : undefined;
}

/** The method and, when mixed, the verdict sources: `both (CPU toggle · mem relaunch)`. */
export function methodText(
  report: Pick<OverheadReport, "method" | "cpuVerdictSource" | "memVerdictSource">,
): string {
  switch (report.method) {
    case "relaunch":
      return "relaunch";
    case "toggle":
      return `toggle (mem ${MEM_NOT_MEASURED})`;
    case "both":
      return `both (CPU ${report.cpuVerdictSource} · mem ${report.memVerdictSource})`;
  }
}

/** Memory delta of the relaunch A/B, or `not measured` (method `toggle`). */
export function memDeltaText(report: OverheadReport, unit: DeltaUnit): string {
  return report.memVerdictSource === "notMeasured"
    ? MEM_NOT_MEASURED
    : deltaText(report.metrics.memBytes, unit);
}

/** Toggle A/B settings: `10 ABBA quartets × 4 × 3000 ms blocks (500 ms settle)`. */
export function toggleConfigText(toggle: Pick<OverheadToggleSummaryV3, "config">): string {
  const { quartets, blockMs, settleMs } = toggle.config;
  return `${quartets} ABBA quartets × 4 × ${blockMs} ms blocks (${settleMs} ms settle)`;
}

/**
 * Toggle A/B checks: longest toggle round trip, flagged blocks (process set), late starts, UA calls
 * in on / off blocks and renderer records in off blocks (expected 0):
 * `toggle ≤ 12 ms · 1 flagged block(s) (process set) · UA 2 calls in on blocks`.
 */
export function toggleFlagsText(toggle: OverheadToggleSummaryV3): string {
  const flags = [`toggle ≤ ${toggle.toggleLatencyMsMax.toFixed(0)} ms`];
  if (toggle.flaggedBlocks > 0) {
    flags.push(`${toggle.flaggedBlocks} flagged block(s) (process set)`);
  }
  if (toggle.lateStartBlocks > 0) {
    flags.push(`${toggle.lateStartBlocks} late start(s)`);
  }
  const { onBlocks, offBlocks } = toggle.uaCalls;
  if (onBlocks > 0 || offBlocks > 0) {
    const off = offBlocks > 0 ? `, ${offBlocks} in off blocks` : "";
    flags.push(`UA ${onBlocks} calls in on blocks${off}`);
  }
  if (toggle.rendererRecords.offBlocks > 0) {
    flags.push(`${toggle.rendererRecords.offBlocks} renderer record(s) in off blocks`);
  }
  return flags.join(" · ");
}

/** Label of the toggle sub-row without the UA memory probe (`toggleWithoutUaProbe`). */
export const TOGGLE_WITHOUT_UA_PROBE_LABEL = "toggle without UA probe (informational)";

/**
 * Label of the frame-probe toggle sub-row (`toggleFrameProbe`): telemetry off in both arms, only the
 * benchmark's rAF frame loop toggled. Harness cost, no telemetry verdict.
 */
export const TOGGLE_FRAME_PROBE_LABEL = "benchmark FPS probe (harness, not shipped)";

/** Per-process-type deltas shown (largest |mean| first). */
const PROCESS_DELTAS_SHOWN = 3;

/**
 * Where a toggle A/B's CPU delta lands, per process type (`toggleProcessTypeDeltas`, top 3):
 * `gpu +0.94 pp (10/10 ↑) · browser +0.57 pp (9/10 ↑) · renderer +0.10 pp (6/10 ↑)`; `—` without
 * the per-type split.
 */
export function toggleProcessDeltasText(toggle: OverheadToggleSummaryV3): string {
  const deltas = toggleProcessTypeDeltas(toggle).slice(0, PROCESS_DELTAS_SHOWN);
  if (deltas.length === 0) {
    return NONE;
  }
  return deltas
    .map(
      ({ processType, meanPctPoints, positiveQuartets, quartets }) =>
        `${processType} ${signedText(meanPctPoints, 2)} pp (${positiveQuartets}/${quartets} ↑)`,
    )
    .join(" · ");
}

/**
 * Label of the direct CPU attribution sub-row (`directAttribution`): JS time in telemetry sources
 * from a CDP profile, with its own verdict next to the statistical (toggle) CPU verdict.
 */
export const DIRECT_ATTRIBUTION_LABEL = "direct (JS only)";

/** A measured direct attribution section. */
type MeasuredDirectAttribution = Extract<DirectAttributionV3, { status: "measured" }>;

/** Profiled period: `10 s profile @ 100 µs`. */
export function directAttributionSamplesText(section: DirectAttributionV3): string {
  const { profileMs, samplingIntervalUs } = section.config;
  return `${(profileMs / 1000).toFixed(0)} s profile @ ${samplingIntervalUs} µs`;
}

/** Relative telemetry CPU and its upper bound: `+0.07 % (≤ +0.10 %)`; `—` without a baseline. */
export function directAttributionRelativeText(section: MeasuredDirectAttribution): string {
  const { relative, relativeUpperBound } = section;
  if (relative == undefined || relativeUpperBound == undefined) {
    return NONE;
  }
  const percent = (value: number) => `${signedText(value * 100, 2)} %`;
  return `${percent(relative)} (≤ ${percent(relativeUpperBound)})`;
}

/** Telemetry CPU in percentage points of one core (`ms/s ÷ 10`): `+0.02 pp`. */
export function directAttributionPpText(section: MeasuredDirectAttribution): string {
  return `${signedText(section.telemetryMsPerSec / 10, 2)} pp`;
}

/**
 * Telemetry over the off-block CPU:
 * `telemetry 0.20 ms/s ÷ off CPU 300 ms/s = +0.07 % (≤ +0.10 %)`.
 */
export function directAttributionText(section: MeasuredDirectAttribution): string {
  const telemetry = `telemetry ${section.telemetryMsPerSec.toFixed(2)} ms/s`;
  if (section.offCpuMsPerSec == undefined) {
    return `${telemetry} (no off-block CPU baseline)`;
  }
  return `${telemetry} ÷ off CPU ${section.offCpuMsPerSec.toFixed(0)} ms/s = ${directAttributionRelativeText(section)}`;
}

/**
 * Profile checks: `JS stacks 120.0 ms/s (wall) · resolved 99.9 % · GC 5.0 % (not attributable)`.
 */
export function directAttributionFlagsText(section: MeasuredDirectAttribution): string {
  return [
    `JS stacks ${section.jsMsPerSec.toFixed(1)} ms/s (wall)`,
    `resolved ${(section.resolvedShare * 100).toFixed(1)} %`,
    `GC ${(section.gcShare * 100).toFixed(1)} % (not attributable)`,
  ].join(" · ");
}

/**
 * Top telemetry functions with their file name and line:
 * `record (BufferedTelemetrySink.ts:40) 0.15 ms/s; …`; `—` for none.
 */
export function directAttributionTopText(section: MeasuredDirectAttribution): string {
  if (section.topFunctions.length === 0) {
    return NONE;
  }
  return section.topFunctions
    .map(
      ({ source, line, name, msPerSec }) =>
        `${name} (${source.slice(source.lastIndexOf("/") + 1)}:${line}) ${msPerSec.toFixed(2)} ms/s`,
    )
    .join("; ");
}

/** Flags cell of the direct attribution row: checks and top functions, or why it is missing. */
export function directAttributionRowFlagsText(section: DirectAttributionV3): string {
  if (section.status === "unsupported") {
    return `unsupported: ${section.reason}`;
  }
  return `${directAttributionFlagsText(section)} · top: ${directAttributionTopText(section)}`;
}

/** The units of a toggle section as `CpuVerdictStats` (`cpuSamplesText`, CPU cells). */
export function toggleCpuStats(toggle: OverheadToggleSummaryV3): CpuVerdictStats {
  return { source: "toggle", n: toggle.n, excluded: toggle.excludedQuartets, ...toggle.metrics };
}

/**
 * The toggle coverage note (`toggleCoverageNote`), the toggle flags (when it ran) and the relaunch
 * runs' flags (when they ran); `—` for none.
 */
export function reportFlagsText(report: OverheadReport): string {
  const flags = [
    toggleCoverageNote(report) ?? NONE,
    report.toggle == undefined ? NONE : toggleFlagsText(report.toggle),
    report.runs.length === 0 ? NONE : overheadFlagsText(report),
  ].filter((flag) => flag !== NONE);
  return flags.length === 0 ? NONE : flags.join("; ");
}

/** Why a run's steady window mismatched: `r1 on: 9/10 polls, 2 overruns`. */
function windowMismatchReason(run: OverheadReport["runs"][number]): string {
  const { polls, requestedPolls, overruns } = run.steady;
  const reasons = [
    polls < requestedPolls ? `${polls}/${requestedPolls} polls` : "",
    overruns > 0 ? `${overruns} overrun(s)` : "",
  ].filter((reason) => reason !== "");
  return `r${run.repeat} ${run.arm}: ${reasons.join(", ")}`;
}

/** Longest host poll over the runs that report it (`undefined` for older results). */
function maxPollLatencyMs(runs: OverheadReport["runs"]): number | undefined {
  let max: number | undefined;
  for (const run of runs) {
    const latency = run.steady.maxPollLatencyMs;
    if (latency != undefined && (max == undefined || latency > max)) {
      max = latency;
    }
  }
  return max;
}

/**
 * Window-mismatch runs with their reasons, process-set mismatches and the longest host poll:
 * `1 window mismatch run(s) (r0 on: 2 overrun(s)), max poll 1200 ms`; `—` when there is nothing
 * to report.
 */
export function overheadFlagsText(
  report: Pick<OverheadReport, "windowMismatchRuns" | "processSetMismatches" | "runs">,
): string {
  const mismatchReasons = report.runs
    .filter((run) => run.steady.windowMismatch)
    .map(windowMismatchReason);
  const mismatchDetail = mismatchReasons.length > 0 ? ` (${mismatchReasons.join("; ")})` : "";
  const maxLatency = maxPollLatencyMs(report.runs);
  const flags = [
    report.windowMismatchRuns > 0
      ? `${report.windowMismatchRuns} window mismatch run(s)${mismatchDetail}`
      : "",
    report.processSetMismatches > 0
      ? `${report.processSetMismatches} process-set mismatch(es)`
      : "",
    maxLatency == undefined ? "" : `max poll ${maxLatency.toFixed(0)} ms`,
  ].filter((flag) => flag !== "");
  return flags.length === 0 ? NONE : flags.join(", ");
}

/** UA memory probe of the on arm (medians, whole run): `UA 2 calls · 1 resolved · 12.0 s to resolve`. */
function uaProbeText(selfCost: OverheadSelfCostSummary): string | undefined {
  if (selfCost.uaCalls <= 0) {
    return undefined;
  }
  const parts = [`UA ${selfCost.uaCalls} calls`];
  if (selfCost.uaResolved != undefined) {
    parts.push(`${selfCost.uaResolved} resolved`);
  }
  if (selfCost.uaFailures != undefined && selfCost.uaFailures > 0) {
    parts.push(`${selfCost.uaFailures} rejected`);
  }
  if (selfCost.uaResolveMsMean != undefined) {
    parts.push(`${(selfCost.uaResolveMsMean / 1000).toFixed(1)} s to resolve`);
  }
  return parts.join(" · ");
}

/**
 * In-page self-cost of the on arm: `2.00 ms/s (0.20 % core) · 100 rec/s · 200 ns/rec` plus the UA
 * memory probe when it was called (see `uaProbeText`).
 */
export function selfCostText(selfCost: OverheadSelfCostSummary | undefined): string {
  if (selfCost == undefined) {
    return NONE;
  }
  const parts = [
    `${selfCost.msPerSec.toFixed(2)} ms/s (${(selfCost.fractionOfCore * 100).toFixed(2)} % core)`,
    `${selfCost.recordsPerSec.toFixed(0)} rec/s`,
  ];
  if (selfCost.meanEmitNs != undefined) {
    parts.push(`${selfCost.meanEmitNs.toFixed(0)} ns/rec`);
  }
  const ua = uaProbeText(selfCost);
  if (ua != undefined) {
    parts.push(ua);
  }
  return parts.join(" · ");
}

/** Main-thread probe deltas (medians): `blocked +1.0 ms/s · -1.0 fps`. */
export function mainThreadText(metrics: OverheadComparisonSummary["metrics"]): string {
  const blocked = metrics.mainThreadBlockedMsPerSec.median;
  const fps = metrics.fps.median;
  if (blocked == undefined && fps == undefined) {
    return NONE;
  }
  const blockedText = blocked == undefined ? NONE : `${signedText(blocked, 1)} ms/s`;
  const fpsText = fps == undefined ? NONE : `${signedText(fps, 1)} fps`;
  return `blocked ${blockedText} · ${fpsText}`;
}
