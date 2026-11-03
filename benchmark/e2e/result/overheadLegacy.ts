// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Reads overhead A/B reports of any schema as schema 3 (`OverheadReportV3`): schema 2 as a
// relaunch-only report, schema 1 through schema 2, and a schema-3 toggle section from before the
// ABBA quartets (adjacent pairs only) re-summarized from its blocks. An incomplete
// `toggleWithoutUaProbe`, `toggleFrameProbe` or `directAttribution` section is dropped. Free of DOM/Playwright/Node
// imports (used by the HTML report and the CI summary).

import { OVERHEAD_METRIC_KEYS } from "./constants";
import { worstVerdict } from "./stats";
import type { MetricStats } from "./stats.types";
import type {
  OverheadMetrics,
  OverheadPairDeltas,
  OverheadReportV1,
  OverheadReportV2,
  OverheadReportV3,
  OverheadRunStatsV1,
  OverheadRunV2,
} from "../runner/overhead.types";
import { BLOCKS_PER_QUARTET, summarizeToggleBlocks } from "../runner/toggleBlocks";
import type { OverheadToggleSummaryV3, ToggleConfigV3 } from "../runner/toggleBlocks.types";

/**
 * A schema-3 toggle section written before the ABBA quartets: statistics over adjacent off/on
 * pairs, `config.pairs` instead of `config.quartets`. Its blocks are complete.
 */
type PairToggleSummary = Pick<
  OverheadToggleSummaryV3,
  "blocks" | "modalProcessSet" | "runDurationMs"
> & { config: Omit<ToggleConfigV3, "quartets"> & { pairs: number } };

/** One value as `MetricStats` of a single pair (CI collapsed to the value). */
function singleValueStats(value: number | undefined): MetricStats {
  if (value == undefined || !Number.isFinite(value)) {
    return { n: 0 };
  }
  return { n: 1, median: value, iqr: 0, ci95: { lower: value, upper: value } };
}

/** A schema-1 whole-window run as a schema-2 run (no per-type memory, process set or probe). */
function legacyRun(stats: OverheadRunStatsV1, order: number): OverheadRunV2 {
  return {
    arm: stats.telemetryEnabled ? "on" : "off",
    repeat: 0,
    order,
    sequence: order,
    telemetryEnabled: stats.telemetryEnabled,
    steady: {
      warmupMs: 0,
      requestedPolls: stats.hostPolls,
      polls: stats.hostPolls,
      overruns: 0,
      windowMismatch: false,
      startMonotonicTs: 0,
      endMonotonicTs: 0,
      medianTotalCpuPercent: stats.medianTotalCpuPercent,
      meanTotalCpuPercent: stats.medianTotalCpuPercent,
      meanTotalWorkingSetBytes: stats.meanTotalWorkingSetBytes,
      peakTotalWorkingSetBytes: stats.peakTotalWorkingSetBytes,
      meanWorkingSetBytesByType: {},
      processSet: {},
    },
  };
}

/**
 * A schema-1 report (one off → on pair, point deltas) as schema 2: `n = 1`, CI collapsed to the
 * value, every verdict `inconclusive` (one pair cannot support a verdict), `legacy: true`.
 */
export function normalizeLegacyOverheadReport(report: OverheadReportV1): OverheadReportV2 {
  const deltas: OverheadPairDeltas = {
    ...(report.deltas.cpuDeltaRelative != undefined && {
      cpuRelative: report.deltas.cpuDeltaRelative,
    }),
    cpuPctPoints: report.deltas.cpuDeltaPctPoints,
    memBytes: report.deltas.memDeltaBytes,
    memBytesCommonProcesses: report.deltas.memDeltaBytes,
  };
  const metrics = Object.fromEntries(
    OVERHEAD_METRIC_KEYS.map((key) => [key, singleValueStats(deltas[key])]),
  ) as OverheadMetrics;
  return {
    schemaVersion: 2,
    kind: "overhead",
    platform: report.platform,
    scenarioId: report.scenarioId,
    createdAtWall: report.createdAtWall,
    legacy: true,
    config: {
      repeats: 1,
      warmupRuns: 0,
      arms: ["off", "on"],
      warmupMs: 0,
      polls: report.on.hostPolls,
      sampleIntervalMs: 0,
    },
    runs: [legacyRun(report.off, 0), legacyRun(report.on, 1)],
    pairs: [
      {
        comparison: "on-vs-off",
        repeat: 0,
        order: "off-first",
        baseArm: "off",
        treatmentArm: "on",
        deltas,
        excluded: false,
        reasons: [],
        flags: [],
      },
    ],
    n: 1,
    excludedPairs: 0,
    processSetMismatches: 0,
    windowMismatchRuns: 0,
    metrics,
    verdicts: { cpu: "inconclusive", memory: "inconclusive", overall: "inconclusive" },
    targets: report.targets,
  };
}

/**
 * A schema-2 report (relaunch A/B only) as schema 3: method `relaunch`, both verdicts from the
 * relaunch A/B (`relaunchVerdicts` = `verdicts`), no toggle section.
 */
export function normalizeV2OverheadReport(report: OverheadReportV2): OverheadReportV3 {
  return {
    ...report,
    schemaVersion: 3,
    method: "relaunch",
    config: { ...report.config, method: "relaunch" },
    cpuVerdictSource: "relaunch",
    memVerdictSource: "relaunch",
    relaunchVerdicts: report.verdicts,
  };
}

/**
 * A schema-3 report whose toggle section predates the ABBA quartets: the section re-summarized from
 * its blocks (`summarizeToggleBlocks`, complete quartets only) and, when the toggle A/B gave the
 * CPU verdict, the CPU and overall verdicts updated.
 */
export function normalizePairToggleReport(report: OverheadReportV3): OverheadReportV3 {
  const legacyToggle = report.toggle as unknown as PairToggleSummary;
  const { pairs, ...config } = legacyToggle.config;
  const toggle = summarizeToggleBlocks({
    blocks: legacyToggle.blocks,
    modalProcessSet: legacyToggle.modalProcessSet,
    config: { ...config, quartets: Math.floor((pairs * 2) / BLOCKS_PER_QUARTET) },
    cpuDeltaRelativeMax: report.targets.cpuDeltaRelativeMax,
    ...(legacyToggle.runDurationMs != undefined && { runDurationMs: legacyToggle.runDurationMs }),
  });
  const { memory } = report.verdicts;
  const verdicts =
    report.cpuVerdictSource === "toggle"
      ? {
          ...report.verdicts,
          cpu: toggle.verdict,
          overall: worstVerdict(memory == undefined ? [toggle.verdict] : [toggle.verdict, memory]),
        }
      : report.verdicts;
  return {
    ...report,
    config: { ...report.config, toggle: toggle.config },
    verdicts,
    toggle,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != undefined && !Array.isArray(value);
}

/** Shallow shape check of the schema-2 fields (also in schema 3) the report and scorecard read. */
function hasRelaunchFields(json: Record<string, unknown>): boolean {
  return (
    Array.isArray(json.runs) &&
    Array.isArray(json.pairs) &&
    isRecord(json.metrics) &&
    isRecord(json.verdicts) &&
    isRecord(json.targets)
  );
}

/** Shallow shape check of the schema-3 fields besides the toggle section. */
function hasV3Fields(json: Record<string, unknown>): boolean {
  return (
    json.schemaVersion === 3 &&
    hasRelaunchFields(json) &&
    typeof json.method === "string" &&
    typeof json.cpuVerdictSource === "string" &&
    typeof json.memVerdictSource === "string"
  );
}

/** Shallow shape check of a complete (quartet) toggle section. */
function isToggleSection(toggle: unknown): boolean {
  return (
    isRecord(toggle) &&
    isRecord(toggle.metrics) &&
    Array.isArray(toggle.blocks) &&
    Array.isArray(toggle.quartets)
  );
}

/** Shallow shape check of a schema-3 report (a toggle section, when present, must be complete). */
function isReportV3(json: Record<string, unknown>): boolean {
  return hasV3Fields(json) && (json.toggle == undefined || isToggleSection(json.toggle));
}

/** Shallow shape check of a direct CPU attribution section (`unsupported` or `measured`). */
function isDirectAttributionSection(section: unknown): boolean {
  if (!isRecord(section) || !isRecord(section.config)) {
    return false;
  }
  if (section.status === "unsupported") {
    return typeof section.reason === "string";
  }
  return (
    section.status === "measured" &&
    typeof section.telemetryMsPerSec === "number" &&
    typeof section.jsMsPerSec === "number" &&
    typeof section.verdict === "string" &&
    Array.isArray(section.topFunctions)
  );
}

/**
 * A schema-3 report without an incomplete `toggleWithoutUaProbe`, `toggleFrameProbe` or
 * `directAttribution` (all informational next to the toggle verdict, so a malformed one is dropped
 * instead of rejecting the report).
 */
function withValidToggleVariant(json: Record<string, unknown>): OverheadReportV3 {
  const {
    toggleWithoutUaProbe,
    toggleFrameProbe,
    directAttribution,
    ...report
  }: Record<string, unknown> = json;
  return {
    ...report,
    ...(toggleWithoutUaProbe != undefined &&
      isToggleSection(toggleWithoutUaProbe) && { toggleWithoutUaProbe }),
    ...(toggleFrameProbe != undefined && isToggleSection(toggleFrameProbe) && { toggleFrameProbe }),
    ...(directAttribution != undefined &&
      isDirectAttributionSection(directAttribution) && { directAttribution }),
  } as unknown as OverheadReportV3;
}

/** Shallow shape check of a schema-3 report with a toggle section from before the quartets. */
function isPairToggleReportV3(json: Record<string, unknown>): boolean {
  const toggle = json.toggle;
  return (
    hasV3Fields(json) &&
    isRecord(toggle) &&
    toggle.quartets == undefined &&
    Array.isArray(toggle.blocks) &&
    isRecord(toggle.modalProcessSet) &&
    isRecord(toggle.config) &&
    typeof toggle.config.pairs === "number"
  );
}

/** Shallow shape check of a schema-2 report. */
function isReportV2(json: Record<string, unknown>): boolean {
  return json.schemaVersion === 2 && hasRelaunchFields(json);
}

/** Shallow shape check of a schema-1 report. */
function isReportV1(json: Record<string, unknown>): boolean {
  return (
    json.schemaVersion === 1 &&
    isRecord(json.off) &&
    isRecord(json.on) &&
    isRecord(json.deltas) &&
    isRecord(json.targets)
  );
}

/**
 * A parsed overhead report file of schema 1, 2 or 3 as schema 3; undefined for anything else (not
 * an overhead report, unknown schema, missing fields).
 */
export function normalizeOverheadReport(json: unknown): OverheadReportV3 | undefined {
  if (!isRecord(json) || json.kind !== "overhead" || typeof json.scenarioId !== "string") {
    return undefined;
  }
  if (isReportV3(json)) {
    return withValidToggleVariant(json);
  }
  if (isPairToggleReportV3(json)) {
    return normalizePairToggleReport(withValidToggleVariant(json));
  }
  if (isReportV2(json)) {
    return normalizeV2OverheadReport(json as unknown as OverheadReportV2);
  }
  if (isReportV1(json)) {
    return normalizeV2OverheadReport(
      normalizeLegacyOverheadReport(json as unknown as OverheadReportV1),
    );
  }
  return undefined;
}
