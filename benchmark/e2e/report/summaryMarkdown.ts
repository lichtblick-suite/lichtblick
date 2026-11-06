// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Pure markdown builders for the CI benchmark summary (`ci-helpers/generate-benchmark-summary.ts`).
// Compiled by the root tsconfig through that script: keep free of DOM/Playwright imports.

import {
  KIB,
  MEM_NOT_MEASURED,
  MIB,
  NONE,
  OVERHEAD_UNITS,
  PLATFORM_ORDER,
  SCENARIO_NOT_RECORDED,
} from "./constants";
import {
  cpuVerdictStats,
  deltaText,
  iqrText,
  mainThreadText,
  memDeltaText,
  methodText,
  overheadFlagsText,
  cpuSamplesText,
  DIRECT_ATTRIBUTION_LABEL,
  directAttributionPpText,
  directAttributionRelativeText,
  directAttributionRowFlagsText,
  directAttributionSamplesText,
  pairsText,
  reportFlagsText,
  selfCostText,
  TOGGLE_FRAME_PROBE_LABEL,
  TOGGLE_WITHOUT_UA_PROBE_LABEL,
  toggleCpuStats,
  toggleFlagsText,
  toggleProcessDeltasText,
  verdictText,
} from "./overheadText";
import type { CpuVerdictStats } from "./overheadText.types";
import { LOW_FPS_WARNING } from "../result/constants";
import { aggregateKpis } from "../result/kpis";
import type { KpiAggregateV1, KpiRun, PlatformScorecardV1 } from "../result/kpis.types";
import { scenarioRunsOnly } from "../result/runMode";
import type { PersistedResultV1, ScenarioDescriptorV1 } from "../result/schemaV1";
import type { OverheadComparisonSummary, OverheadReport } from "../runner/overhead.types";
import { compareCodeUnits } from "../shared/compare";

function formatMiB(bytes: number | undefined): string {
  return bytes == undefined ? NONE : `${(bytes / MIB).toFixed(1)} MiB`;
}

function formatMs(ms: number | undefined): string {
  return ms == undefined ? NONE : `${Math.round(ms)} ms`;
}

function formatPercent(value: number | undefined, digits = 1): string {
  return value == undefined ? NONE : `${value.toFixed(digits)} %`;
}

/** Lexicographic comparison of string tuples. */
function compareKeys(a: readonly string[], b: readonly string[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const order = a[i]!.localeCompare(b[i]!);
    if (order !== 0) {
      return order;
    }
  }
  return a.length - b.length;
}

/** Scenario, then platform, then telemetry on before off. */
function sortKey(result: PersistedResultV1): string[] {
  const { scenarioId, platform, telemetryEnabled } = result.run;
  return [scenarioId, platform, telemetryEnabled ? "0" : "1"];
}

/**
 * Keeps the latest scenario run per scenario × platform × telemetry mode. Overhead A/B runs
 * (`isOverheadRun`) are dropped: their steady window, durations and extra arm are not comparable
 * with scenario runs; they are summarized by their `overhead-*.json` reports.
 */
export function latestResults(results: readonly PersistedResultV1[]): PersistedResultV1[] {
  const latest = new Map<string, PersistedResultV1>();
  for (const result of scenarioRunsOnly(results)) {
    const { scenarioId, platform, telemetryEnabled } = result.run;
    const key = `${scenarioId}|${platform}|${telemetryEnabled}`;
    const existing = latest.get(key);
    if (existing == undefined || existing.run.finishedAtWall < result.run.finishedAtWall) {
      latest.set(key, result);
    }
  }
  return [...latest.values()].sort((a, b) => compareKeys(sortKey(a), sortKey(b)));
}

function poolCells(result: PersistedResultV1): [string, string] {
  const pools = Object.values(result.summary.hydratedSourcePool?.pools ?? {});
  if (pools.length === 0) {
    return [NONE, NONE];
  }
  const invariant = pools.every((pool) => pool.invariantHolds) ? "✅" : "❌";
  let periods = 0;
  let durationMs = 0;
  for (const pool of pools) {
    periods += pool.overBudgetPeriods;
    durationMs += pool.overBudgetDurationMs;
  }
  return [invariant, `${periods} / ${formatMs(durationMs)}`];
}

/** One row per scenario × platform (latest run) from `*.benchmark-result.v1.json`. */
export function buildResultsTable(results: readonly PersistedResultV1[]): string {
  if (results.length === 0) {
    return "\nNo benchmark-result.v1 files found.\n";
  }
  const lines = [
    "| Scenario | Platform | Telemetry | Peak total WS | Median total CPU | Peak JS heap | Dispatch p50 / p90 | First message | First useful frame | Pool invariant | Over budget (periods / duration) |",
    "|----------|----------|-----------|---------------|------------------|--------------|--------------------|---------------|--------------------|----------------|----------------------------------|",
  ];
  for (const result of latestResults(results)) {
    const { run, summary } = result;
    const dispatch = summary.listenerDispatchDurationMs;
    const [invariant, overBudget] = poolCells(result);
    const cells = [
      run.scenarioId,
      run.platform,
      run.telemetryEnabled ? "on" : "off",
      formatMiB(summary.process.peakTotalWorkingSetBytes),
      formatPercent(summary.process.medianTotalCpuPercent),
      formatMiB(summary.renderer.peakJsHeapUsedBytes),
      dispatch == undefined ? NONE : `${dispatch.p50.toFixed(2)} / ${dispatch.p90.toFixed(2)} ms`,
      formatMs(summary.phases.firstMessageMs),
      formatMs(summary.phases.firstUsefulFrameMs),
      invariant,
      overBudget,
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }
  return `\n${lines.join("\n")}\n`;
}

function formatBytes(bytes: number): string {
  if (bytes >= MIB) {
    return `${(bytes / MIB).toFixed(1)} MiB`;
  }
  if (bytes >= KIB) {
    return `${(bytes / KIB).toFixed(1)} KiB`;
  }
  return `${bytes} B`;
}

function formatRatio(value: number | undefined): string {
  return value == undefined ? NONE : formatPercent(value * 100);
}

function escapeCell(text: string): string {
  return text.replaceAll("|", String.raw`\|`);
}

/** One-line pipeline digest of a run (`summary.pipeline`). */
export function buildPipelineLine(result: PersistedResultV1): string {
  const pipeline = result.summary.pipeline;
  if (pipeline == undefined) {
    return `Pipeline: ${NONE}`;
  }
  const parts = [
    `${pipeline.messagesPerSec == undefined ? NONE : pipeline.messagesPerSec.toFixed(0)} msg/s`,
    `${pipeline.bytesPerSec == undefined ? NONE : (pipeline.bytesPerSec / MIB).toFixed(2)} MiB/s`,
    `fanout ${pipeline.deliveredFanout == undefined ? NONE : pipeline.deliveredFanout.toFixed(2)}`,
    `block cache peak ${formatMiB(pipeline.blockCachePeakBytes)}`,
    `source cache hit ratio ${formatRatio(pipeline.sourceCacheHitRatio)}`,
    `remote read ${formatMiB(pipeline.remoteBytesRead)}`,
  ];
  return `Pipeline: ${parts.join(" · ")}`;
}

/**
 * Per-run panel table (`summary.panels`), one row per layout panel. `First render` is only emitted
 * by `PanelExtensionAdapter` panels (3D, Image, Map, ...); built-in React panels show "—".
 */
export function buildPanelsTable(result: PersistedResultV1): string {
  const panels = Object.entries(result.summary.panels ?? {});
  if (panels.length === 0) {
    return "No panel telemetry.";
  }
  const lines = [
    "| Panel | Type | Messages | Bytes | Range msgs | Render mean / max | First render |",
    "|-------|------|----------|-------|------------|-------------------|--------------|",
  ];
  for (const [panelId, panel] of panels) {
    const renders =
      panel.renderMeanMs == undefined || panel.renderMaxMs == undefined
        ? NONE
        : `${panel.renderMeanMs.toFixed(2)} / ${panel.renderMaxMs.toFixed(2)} ms (${panel.renders ?? 0})`;
    const cells = [
      escapeCell(panelId),
      escapeCell(panel.panelType),
      String(panel.messages),
      formatBytes(panel.messageBytes),
      String(panel.rangeMessages),
      renders,
      formatMs(panel.firstRenderMs),
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }
  return lines.join("\n");
}

/**
 * Per scenario × platform (latest telemetry-on run): a pipeline line and the panels table. Runs
 * with telemetry off carry no panel/pipeline telemetry and are skipped.
 */
export function buildPanelsSection(results: readonly PersistedResultV1[]): string {
  const runs = latestResults(results).filter((result) => result.run.telemetryEnabled);
  if (runs.length === 0) {
    return "\nNo benchmark-result.v1 files with telemetry found.\n";
  }
  const blocks = runs.map((result) => {
    const { run, summary } = result;
    const coverage = summary.phases.panelsReadyCoverage;
    const lines = [`### ${run.scenarioId} (${run.platform})`, "", buildPipelineLine(result)];
    if (coverage != undefined) {
      lines.push(
        "",
        `Panels ready: ${formatMs(summary.phases.panelsReadyMs)} after ${summary.phases.origin ?? NONE} (firstRender from ${coverage.firstRendered} of ${coverage.mounted} mounted panels)`,
      );
    }
    lines.push("", buildPanelsTable(result));
    return lines.join("\n");
  });
  return `\n${blocks.join("\n\n")}\n`;
}

/** `+1.00 % [+0.50, +1.50] (+0.4 pp) IQR 0.80 %` of a CPU delta. */
function cpuDeltaCell(stats: Pick<CpuVerdictStats, "cpuRelative" | "cpuPctPoints">): string {
  const relative = deltaText(stats.cpuRelative, OVERHEAD_UNITS.cpuRelative);
  const points = deltaText(stats.cpuPctPoints, OVERHEAD_UNITS.cpuPp);
  const iqr = iqrText(stats.cpuRelative, OVERHEAD_UNITS.cpuRelative);
  return iqr === NONE ? `${relative} (${points})` : `${relative} (${points}) IQR ${iqr}`;
}

/**
 * Sub-rows of an overhead report: the direct (JS only) CPU attribution (own verdict), the toggle A/B
 * without the UA memory probe (web, informational), the benchmark FPS probe (harness, no verdict),
 * the relaunch A/B when the toggle A/B gave the CPU verdict (method `both`, CPU informational) and
 * the UA-probe comparisons (`on-noUa` arm, web).
 */
function overheadSubRows(report: OverheadReport): string[] {
  const rows: string[] = [];
  const row = (
    label: string,
    summary: OverheadComparisonSummary,
    verdict: string,
    flags: string = "",
  ) =>
    `| ${report.platform} | ↳ ${label} | relaunch | ${pairsText(summary)} | ${cpuDeltaCell(summary.metrics)} | ${deltaText(summary.metrics.memBytes, OVERHEAD_UNITS.memMiB)} | ${verdict} | ${flags} | | ${mainThreadText(summary.metrics)} |`;
  const { directAttribution, toggleWithoutUaProbe, toggleFrameProbe } = report;
  if (directAttribution != undefined) {
    const measured = directAttribution.status === "measured" ? directAttribution : undefined;
    const cpu =
      measured == undefined
        ? NONE
        : `${directAttributionRelativeText(measured)} (${directAttributionPpText(measured)})`;
    rows.push(
      `| ${report.platform} | ↳ ${DIRECT_ATTRIBUTION_LABEL} | direct | ${directAttributionSamplesText(directAttribution)} | ${cpu} | ${MEM_NOT_MEASURED} | ${measured == undefined ? NONE : verdictText(measured.verdict)} | ${escapeCell(directAttributionRowFlagsText(directAttribution))} | | |`,
    );
  }
  if (toggleWithoutUaProbe != undefined) {
    rows.push(
      `| ${report.platform} | ↳ ${TOGGLE_WITHOUT_UA_PROBE_LABEL} | toggle | ${cpuSamplesText(toggleCpuStats(toggleWithoutUaProbe))} | ${cpuDeltaCell(toggleWithoutUaProbe.metrics)} | ${MEM_NOT_MEASURED} | ${verdictText(toggleWithoutUaProbe.verdict)} | ${toggleFlagsText(toggleWithoutUaProbe)} | | |`,
    );
  }
  if (toggleFrameProbe != undefined) {
    rows.push(
      `| ${report.platform} | ↳ ${TOGGLE_FRAME_PROBE_LABEL} | toggle | ${cpuSamplesText(toggleCpuStats(toggleFrameProbe))} | ${cpuDeltaCell(toggleFrameProbe.metrics)} | ${MEM_NOT_MEASURED} | ${NONE} | ${escapeCell(`${toggleFlagsText(toggleFrameProbe)} · ${toggleProcessDeltasText(toggleFrameProbe)}`)} | | |`,
    );
  }
  if (report.cpuVerdictSource === "toggle" && report.runs.length > 0) {
    const verdict = report.relaunchVerdicts?.overall;
    const verdictCell = verdict == undefined ? NONE : verdictText(verdict);
    rows.push(
      row("relaunch A/B (CPU informational)", report, verdictCell, overheadFlagsText(report)),
    );
  }
  if (report.withoutUaProbe != undefined) {
    const { verdicts, ...summary } = report.withoutUaProbe;
    rows.push(row("without UA probe", summary, verdictText(verdicts.overall)));
  }
  if (report.uaCost != undefined) {
    rows.push(row("UA probe cost", report.uaCost, NONE));
  }
  return rows;
}

/** Final verdicts: CPU from the CPU verdict source, memory from the relaunch A/B (if it ran). */
function overheadRow(report: OverheadReport): string {
  const cpu = cpuVerdictStats(report);
  const cells = [
    report.platform,
    report.scenarioId,
    methodText(report),
    cpuSamplesText(cpu),
    cpuDeltaCell(cpu),
    memDeltaText(report, OVERHEAD_UNITS.memMiB),
    verdictText(report.verdicts.overall),
    reportFlagsText(report),
    selfCostText(report.selfCost),
    mainThreadText(report.metrics),
  ];
  return `| ${cells.join(" | ")} |`;
}

/**
 * Telemetry overhead A/B table from `overhead-*.json` (latest per platform × scenario): method,
 * median of the quartet / pair deltas with the bootstrap CI95 and IQR, and the tri-state verdict.
 * CPU comes from the toggle A/B (ABBA quartets) when it ran (relaunch CPU as an informational
 * sub-row), memory from the relaunch A/B.
 */
export function buildOverheadTable(reports: readonly OverheadReport[]): string {
  if (reports.length === 0) {
    return "\nNo overhead reports found.\n";
  }
  const latest = new Map<string, OverheadReport>();
  for (const report of reports) {
    const key = `${report.platform}|${report.scenarioId}`;
    const existing = latest.get(key);
    if (existing == undefined || existing.createdAtWall < report.createdAtWall) {
      latest.set(key, report);
    }
  }
  const sorted = [...latest.values()].sort((a, b) =>
    compareKeys([a.platform, a.scenarioId], [b.platform, b.scenarioId]),
  );
  const targets = sorted[0]!.targets;
  const lines = [
    `_Report only unless \`BENCHMARK_OVERHEAD_GATE=1\` (fails on \`exceeds\` only). Median of on − off deltas [bootstrap CI95]; within = CI95 upper ≤ target (CPU ≤ ${(targets.cpuDeltaRelativeMax * 100).toFixed(0)} %, mem ≤ ${formatMiB(targets.memDeltaBytesMax)}), exceeds = CI95 lower > target, else inconclusive. CPU from the in-process toggle A/B when it ran (one delta per ABBA quartet of blocks, Σ on / Σ off − 1, which cancels a linear drift), memory from the relaunch A/B (one delta per pair of fresh launches)._`,
    "",
    "| Platform | Scenario | Method | Pairs / quartets | ΔCPU rel. (pp) IQR | ΔWS | Verdict | Flags | Self-cost | Main thread Δ |",
    "|----------|----------|--------|------------------|--------------------|-----|---------|-------|-----------|---------------|",
    ...sorted.flatMap((report) => [overheadRow(report), ...overheadSubRows(report)]),
  ];
  return `\n${lines.join("\n")}\n`;
}

function formatAggregate(aggregate: KpiAggregateV1, unit: string, digits: number): string {
  return aggregate.value == undefined ? NONE : `${aggregate.value.toFixed(digits)}${unit}`;
}

function stabilityCell(card: PlatformScorecardV1): string {
  const { healthy, total } = card.stability;
  return `${healthy === total ? "✅" : "❌"} ${healthy}/${total}`;
}

function fpsCell(card: PlatformScorecardV1): string {
  const fps = formatAggregate(card.metrics.medianFps, "", 1);
  const low = card.lowFpsRuns.length;
  return low === 0 ? fps : `${fps} (⚠ ${low} < ${LOW_FPS_WARNING})`;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function overheadCell(card: PlatformScorecardV1): string {
  const overhead = card.overhead;
  if (overhead == undefined) {
    return NONE;
  }
  const cpu = overhead.worstCpuRelative;
  const mem = overhead.worstMemMiB;
  const { toggle, relaunch } = overhead.cpuVerdictSources;
  const cpuSource =
    toggle > 0 && relaunch === 0 ? " (toggle)" : toggle > 0 ? " (toggle/relaunch)" : "";
  const memMissing =
    overhead.memNotMeasuredReports === overhead.reports ? "mem not measured" : "mem n/a";
  const parts = [
    cpu == undefined ? "CPU n/a" : `CPU ≤ ${signed(cpu.ciUpper * 100)} %${cpuSource}`,
    mem == undefined ? memMissing : `mem ≤ ${signed(mem.ciUpper)} MiB`,
  ];
  return `${verdictText(overhead.verdict)} ${parts.join(" / ")} (n ≥ ${overhead.minPairs})`;
}

function scorecardRow(card: PlatformScorecardV1): string {
  const { metrics } = card;
  const cells = [
    card.platform,
    String(card.runs),
    stabilityCell(card),
    formatAggregate(metrics.peakTotalWorkingSetMiB, " MiB", 0),
    formatAggregate(metrics.workingSetSlopeMiBPerMin, " MiB/min", 1),
    formatAggregate(metrics.medianCpuPercent, " %", 1),
    formatAggregate(metrics.cpuSecondsPerMiB, "", 3),
    fpsCell(card),
    formatAggregate(metrics.onTimeFramePercent, " %", 1),
    formatAggregate(metrics.panelsReadyMs, " ms", 0),
    formatAggregate(metrics.ingestMiBPerSec, "", 2),
    overheadCell(card),
  ];
  return `| ${cells.join(" | ")} |`;
}

/** Latest telemetry-on run per scenario × platform, as aggregated by the scorecard. */
function scorecardRuns(results: readonly PersistedResultV1[]): KpiRun[] {
  return latestResults(results)
    .filter((result) => result.run.telemetryEnabled)
    .map((result) => ({ runId: `${result.run.scenarioId}-${result.run.platform}`, result }));
}

/**
 * Compact KPI scorecard, one row per platform with telemetry-on runs or overhead reports (electron
 * and web are never aggregated together).
 * Aggregation per column follows `SCORECARD_POLICIES` (geomean, or worst case for slope / FPS /
 * on-time frames); see the README "KPI scorecard".
 */
export function buildScorecardTable(
  results: readonly PersistedResultV1[],
  overheads: readonly OverheadReport[],
): string {
  const runs = scorecardRuns(results);
  // Like the HTML scorecard: platforms with telemetry-on runs or overhead reports.
  const cards = PLATFORM_ORDER.filter(
    (platform) =>
      runs.some((run) => run.result.run.platform === platform) ||
      overheads.some((report) => report.platform === platform),
  ).map((platform) => aggregateKpis(runs, platform, overheads));
  if (cards.length === 0) {
    return "\nNo benchmark-result.v1 files with telemetry or overhead reports found.\n";
  }
  const lines = [
    "| Platform | Runs | Healthy | Peak WS (geomean) | WS slope (max) | CPU (geomean) | CPU s/MiB (geomean) | Median FPS (min) | On-time frames (min) | Panels ready (geomean) | Ingest MiB/s (geomean) | Telemetry overhead (worst) |",
    "|----------|------|---------|-------------------|----------------|---------------|---------------------|------------------|----------------------|------------------------|------------------------|----------------------------|",
    ...cards.map(scorecardRow),
  ];
  return `\n${lines.join("\n")}\n`;
}

function declaredPanelsText(scenario: ScenarioDescriptorV1): string {
  const counts = new Map<string, number>();
  for (const panel of scenario.panels) {
    counts.set(panel.type, (counts.get(panel.type) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => compareCodeUnits(a, b))
    .map(([type, count]) => `${type} ×${count}`)
    .join(", ");
}

/** `- **<scenario>** (<platforms>): <group> · <panels> · <player>`. */
function exercisesLine(scenarioId: string, runs: readonly PersistedResultV1[]): string {
  const platforms = [...new Set(runs.map((result) => result.run.platform))].join(", ");
  const scenario = runs.find((result) => result.run.scenario != undefined)?.run.scenario;
  const head = `- **${escapeCell(scenarioId)}** (${platforms}):`;
  if (scenario == undefined) {
    return `${head} ${SCENARIO_NOT_RECORDED}`;
  }
  const parts = [scenario.group, declaredPanelsText(scenario) || "no panels", scenario.player];
  return `${head} ${parts.map(escapeCell).join(" · ")}`;
}

/** One "what it exercises" line per scenario (group, declared panels, player). */
export function buildExercisesLines(results: readonly PersistedResultV1[]): string {
  const byScenario = new Map<string, PersistedResultV1[]>();
  for (const result of latestResults(results)) {
    const runs = byScenario.get(result.run.scenarioId) ?? [];
    runs.push(result);
    byScenario.set(result.run.scenarioId, runs);
  }
  if (byScenario.size === 0) {
    return "\nNo benchmark-result.v1 files found.\n";
  }
  const lines = [...byScenario].map(([scenarioId, runs]) => exercisesLine(scenarioId, runs));
  return `\n${lines.join("\n")}\n`;
}
