// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Pure markdown builders for the CI benchmark summary (`ci-helpers/generate-benchmark-summary.ts`).
// Compiled by the root tsconfig through that script: keep free of DOM/Playwright imports.

import { KIB, MIB, NONE, PLATFORM_ORDER, SCENARIO_NOT_RECORDED } from "./constants";
import { LOW_FPS_WARNING } from "../result/constants";
import { aggregateKpis } from "../result/kpis";
import type { KpiAggregateV1, KpiRun, PlatformScorecardV1 } from "../result/kpis.types";
import type { PersistedResultV1, ScenarioDescriptorV1 } from "../result/schemaV1";
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

/** Keeps the latest run per scenario × platform × telemetry mode. */
export function latestResults(results: readonly PersistedResultV1[]): PersistedResultV1[] {
  const latest = new Map<string, PersistedResultV1>();
  for (const result of results) {
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
    "| Panel | Type | Messages | Bytes | Range msgs | Rendered msgs | Render mean / max | First render |",
    "|-------|------|----------|-------|------------|---------------|-------------------|--------------|",
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
      panel.renderedMessages == undefined ? NONE : String(panel.renderedMessages),
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
 * Compact KPI scorecard, one row per platform (electron and web are never aggregated together).
 * Aggregation per column follows `SCORECARD_POLICIES` (geomean, or worst case for slope / FPS /
 * on-time frames); see the README "KPI scorecard".
 */
export function buildScorecardTable(results: readonly PersistedResultV1[]): string {
  const runs = scorecardRuns(results);
  const cards = PLATFORM_ORDER.filter((platform) =>
    runs.some((run) => run.result.run.platform === platform),
  ).map((platform) => aggregateKpis(runs, platform));
  if (cards.length === 0) {
    return "\nNo benchmark-result.v1 files with telemetry found.\n";
  }
  const lines = [
    "| Platform | Runs | Healthy | Peak WS (geomean) | WS slope (max) | CPU (geomean) | CPU s/MiB (geomean) | Median FPS (min) | On-time frames (min) | Panels ready (geomean) | Ingest MiB/s (geomean) |",
    "|----------|------|---------|-------------------|----------------|---------------|---------------------|------------------|----------------------|------------------------|------------------------|",
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
