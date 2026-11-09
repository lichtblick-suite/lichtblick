// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Reads overhead A/B report files of the current schema (3, ABBA toggle quartets) as
// `OverheadReportV3`; any other schema or shape is skipped. The shape checks cover every field the
// renderers (HTML report, CI summary, scorecard KPIs) dereference, so a malformed file is skipped
// instead of throwing. An incomplete `toggleWithoutUaProbe`, `toggleFrameProbe` or
// `directAttribution` section is dropped. Free of DOM/Playwright/Node imports (used by the HTML
// report and the CI summary).

import { isRecord } from "./schemaV1";
import type { Verdict } from "./stats.types";
import type { OverheadMetricKey, OverheadReportV3 } from "../runner/overhead.types";

const VERDICTS: readonly Verdict[] = ["within", "inconclusive", "exceeds"];

/** Relaunch metrics the renderers dereference (CPU / memory cells, main-thread text, KPIs). */
const RENDERED_METRIC_KEYS: readonly OverheadMetricKey[] = [
  "cpuRelative",
  "cpuPctPoints",
  "memBytes",
  "mainThreadBlockedMsPerSec",
  "fps",
];

function isVerdict(value: unknown): value is Verdict {
  return (VERDICTS as readonly unknown[]).includes(value);
}

function isOptionalVerdict(value: unknown): boolean {
  return value == undefined || isVerdict(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

function isOptionalNumber(value: unknown): boolean {
  return value == undefined || isNumber(value);
}

function hasNumbers(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => isNumber(record[key]));
}

function isArrayOf(value: unknown, isItem: (item: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(isItem);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

/** `{ onBlocks, offBlocks }` counts of a toggle section. */
function isOnOffCounts(value: unknown): boolean {
  return isRecord(value) && hasNumbers(value, ["onBlocks", "offBlocks"]);
}

/** `MetricStats`: numeric `n`, optional numeric `median` / `iqr`, optional numeric `ci95` bounds. */
function isMetricStats(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNumber(value.n) &&
    isOptionalNumber(value.median) &&
    isOptionalNumber(value.iqr) &&
    (value.ci95 == undefined ||
      (isRecord(value.ci95) && hasNumbers(value.ci95, ["lower", "upper"])))
  );
}

/** Relaunch metrics: every entry a `MetricStats`, the rendered ones present. */
function isOverheadMetrics(metrics: unknown): boolean {
  return (
    isRecord(metrics) &&
    Object.values(metrics).every(isMetricStats) &&
    RENDERED_METRIC_KEYS.every((key) => metrics[key] != undefined)
  );
}

/** Verdicts the renderers look up: `cpu` and `overall` required, `memory` optional. */
function isVerdictRecord(verdicts: unknown): boolean {
  return (
    isRecord(verdicts) &&
    isVerdict(verdicts.cpu) &&
    isVerdict(verdicts.overall) &&
    isOptionalVerdict(verdicts.memory)
  );
}

/** A relaunch comparison (`on-vs-off`, `onNoUa-vs-off`, `on-vs-onNoUa`). */
function isComparisonSummary(summary: unknown): summary is Record<string, unknown> {
  return (
    isRecord(summary) &&
    hasNumbers(summary, ["n", "excludedPairs", "processSetMismatches"]) &&
    isOverheadMetrics(summary.metrics)
  );
}

/** Steady-window fields of a run the flags text reads (poll counts only for a mismatch). */
function isRunSteady(steady: unknown): boolean {
  return (
    isRecord(steady) &&
    isOptionalNumber(steady.maxPollLatencyMs) &&
    (steady.windowMismatch !== true || hasNumbers(steady, ["polls", "requestedPolls", "overruns"]))
  );
}

/** A measured relaunch run (run-file links, window-mismatch flags). */
function isRun(run: unknown): boolean {
  return (
    isRecord(run) &&
    isNumber(run.repeat) &&
    isString(run.arm) &&
    (run.resultFile == undefined || isString(run.resultFile)) &&
    isRunSteady(run.steady)
  );
}

/** Relaunch settings shown in the report (repeats, warm-up runs, arms). */
function isRelaunchConfig(config: unknown): boolean {
  return (
    isRecord(config) &&
    hasNumbers(config, ["repeats", "warmupRuns"]) &&
    isArrayOf(config.arms, isString)
  );
}

/** Self-cost medians of the `on` arm (`selfCostText`). */
function isSelfCost(selfCost: unknown): boolean {
  return (
    isRecord(selfCost) &&
    hasNumbers(selfCost, ["msPerSec", "fractionOfCore", "recordsPerSec", "uaCalls"]) &&
    ["meanEmitNs", "estimatedEmitMsPerSec", "uaResolved", "uaFailures", "uaResolveMsMean"].every(
      (key) => isOptionalNumber(selfCost[key]),
    )
  );
}

/** Shape check of the relaunch A/B fields the report and scorecard read. */
function hasRelaunchFields(json: Record<string, unknown>): boolean {
  return (
    isArrayOf(json.runs, isRun) &&
    Array.isArray(json.pairs) &&
    isComparisonSummary(json) &&
    isNumber(json.windowMismatchRuns) &&
    isVerdictRecord(json.verdicts) &&
    isRecord(json.targets) &&
    hasNumbers(json.targets, ["cpuDeltaRelativeMax", "memDeltaBytesMax"]) &&
    isRelaunchConfig(json.config) &&
    (json.relaunchVerdicts == undefined || isVerdictRecord(json.relaunchVerdicts)) &&
    (json.withoutUaProbe == undefined ||
      (isComparisonSummary(json.withoutUaProbe) &&
        isVerdictRecord(json.withoutUaProbe.verdicts))) &&
    (json.uaCost == undefined || isComparisonSummary(json.uaCost)) &&
    (json.selfCost == undefined || isSelfCost(json.selfCost))
  );
}

/** Shape check of the schema-3 fields besides the toggle section. */
function hasV3Fields(json: Record<string, unknown>): boolean {
  return (
    json.schemaVersion === 3 &&
    hasRelaunchFields(json) &&
    isString(json.method) &&
    isString(json.cpuVerdictSource) &&
    isString(json.memVerdictSource)
  );
}

/** A toggle block as `toggleProcessTypeDeltas` and `toggleUntoggledRealms` read it. */
function isToggleBlock(block: unknown): boolean {
  return (
    isRecord(block) &&
    hasNumbers(block, ["index", "measuredMs"]) &&
    isRecord(block.recordsByRealm) &&
    Object.values(block.recordsByRealm).every(isNumber) &&
    (block.cpuPercentByProcessType == undefined ||
      (isRecord(block.cpuPercentByProcessType) &&
        Object.values(block.cpuPercentByProcessType).every(isNumber)))
  );
}

/** An ABBA quartet as `toggleProcessTypeDeltas` reads it. */
function isToggleQuartet(quartet: unknown): boolean {
  return (
    isRecord(quartet) &&
    typeof quartet.excluded === "boolean" &&
    isArrayOf(quartet.offBlocks, isNumber) &&
    isArrayOf(quartet.onBlocks, isNumber)
  );
}

/**
 * Shape check of a complete (quartet) toggle section: settings (`toggleConfigText`), unit counts
 * and CPU statistics (CPU cells, KPIs), checks (`toggleFlagsText`), and blocks / quartets
 * (`toggleProcessTypeDeltas`).
 */
function isToggleSection(toggle: unknown): toggle is Record<string, unknown> {
  return (
    isRecord(toggle) &&
    isRecord(toggle.config) &&
    hasNumbers(toggle.config, ["quartets", "blockMs", "settleMs"]) &&
    hasNumbers(toggle, [
      "n",
      "excludedQuartets",
      "flaggedBlocks",
      "lateStartBlocks",
      "toggleLatencyMsMax",
    ]) &&
    isRecord(toggle.metrics) &&
    isMetricStats(toggle.metrics.cpuRelative) &&
    isMetricStats(toggle.metrics.cpuPctPoints) &&
    isOptionalVerdict(toggle.verdict) &&
    isOnOffCounts(toggle.uaCalls) &&
    isOnOffCounts(toggle.rendererRecords) &&
    isArrayOf(toggle.blocks, isToggleBlock) &&
    isArrayOf(toggle.quartets, isToggleQuartet)
  );
}

/** A toggle section whose verdict is rendered (`toggleWithoutUaProbe`). */
function isToggleSectionWithVerdict(toggle: unknown): boolean {
  return isToggleSection(toggle) && isVerdict(toggle.verdict);
}

/** Shape check of a schema-3 report (a toggle section, when present, must be complete). */
function isReportV3(json: Record<string, unknown>): boolean {
  return hasV3Fields(json) && (json.toggle == undefined || isToggleSection(json.toggle));
}

/** A top telemetry function of a measured direct attribution. */
function isAttributedFunction(entry: unknown): boolean {
  return (
    isRecord(entry) &&
    isString(entry.source) &&
    isString(entry.name) &&
    hasNumbers(entry, ["line", "msPerSec"])
  );
}

/** Shape check of a direct CPU attribution section (`unsupported` or `measured`). */
function isDirectAttributionSection(section: unknown): boolean {
  if (
    !isRecord(section) ||
    !isRecord(section.config) ||
    !hasNumbers(section.config, ["profileMs", "samplingIntervalUs"]) ||
    !isArrayOf(section.config.telemetrySources, isString)
  ) {
    return false;
  }
  if (section.status === "unsupported") {
    return isString(section.reason);
  }
  return (
    section.status === "measured" &&
    hasNumbers(section, ["telemetryMsPerSec", "jsMsPerSec", "resolvedShare", "gcShare"]) &&
    ["offCpuMsPerSec", "relative", "relativeUpperBound"].every((key) =>
      isOptionalNumber(section[key]),
    ) &&
    isVerdict(section.verdict) &&
    isArrayOf(section.topFunctions, isAttributedFunction)
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
      isToggleSectionWithVerdict(toggleWithoutUaProbe) && { toggleWithoutUaProbe }),
    ...(toggleFrameProbe != undefined && isToggleSection(toggleFrameProbe) && { toggleFrameProbe }),
    ...(directAttribution != undefined &&
      isDirectAttributionSection(directAttribution) && { directAttribution }),
  } as unknown as OverheadReportV3;
}

/**
 * A parsed overhead report file of schema 3 (ABBA toggle quartets); undefined for anything else
 * (not an overhead report, another schema version or shape, missing fields).
 */
export function normalizeOverheadReport(json: unknown): OverheadReportV3 | undefined {
  if (!isRecord(json) || json.kind !== "overhead" || typeof json.scenarioId !== "string") {
    return undefined;
  }
  return isReportV3(json) ? withValidToggleVariant(json) : undefined;
}
