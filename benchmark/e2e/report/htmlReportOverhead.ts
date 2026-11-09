// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Telemetry overhead section of the HTML report (schema-3 reports).

import { MEM_NOT_MEASURED, NONE, OVERHEAD_UNITS, RESULTS_HREF, VERDICT_DISPLAY } from "./constants";
import type { Cell } from "./htmlReport.types";
import { latestOverheads } from "./htmlReportData";
import { cell, escapeHtml, fmtMiB, fmtNumber, num, renderTable } from "./htmlReportFormat";
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
  directAttributionText,
  pairsText,
  reportFlagsText,
  selfCostText,
  TOGGLE_FRAME_PROBE_LABEL,
  TOGGLE_WITHOUT_UA_PROBE_LABEL,
  toggleConfigText,
  toggleCoverageNote,
  toggleCpuStats,
  toggleFlagsText,
  toggleProcessDeltasText,
} from "./overheadText";
import type { CpuVerdictStats } from "./overheadText.types";
import type { DirectAttributionV3 } from "../result/directAttribution.types";
import type { MetricStats, Verdict } from "../result/stats.types";
import type {
  OverheadComparisonSummary,
  OverheadReport,
  OverheadRunV2,
} from "../runner/overhead.types";
import type { OverheadToggleSummaryV3 } from "../runner/toggleBlocks.types";

const OVERHEAD_HEADERS = [
  "Scenario",
  "Platform",
  "Created",
  "Method",
  "Pairs / quartets",
  "CPU Δ rel. median [CI95]",
  "CPU Δ IQR",
  "CPU Δ pp",
  "Mem Δ median [CI95]",
  "Verdict",
  "Flags",
  "Self-cost (on arm)",
  "Main thread Δ",
];

/** Verdict badge (within green, exceeds red, inconclusive amber). */
export function verdictBadge(verdict: Verdict | undefined): string {
  if (verdict == undefined) {
    return "—";
  }
  const display = VERDICT_DISPLAY[verdict];
  return `<span class="badge ${display.tone}">${escapeHtml(display.label)}</span>`;
}

function ciTitle(stats: MetricStats, target: string, unit: string = "pairs"): string {
  return `${target}; n = ${stats.n} ${unit} (median [exact order-statistic CI95])`;
}

/**
 * Per-run KPI table: CPU Δ of the scenario's latest overhead report (from its CPU verdict source,
 * toggle or relaunch), toned by the CPU verdict.
 */
export function overheadCpuCell(report: OverheadReport | undefined): Cell {
  if (report == undefined) {
    return num("—");
  }
  const { cpuRelative: stats, source } = cpuVerdictStats(report);
  const target = `target ≤ ${fmtNumber(report.targets.cpuDeltaRelativeMax * 100, 0)} % (relative CPU delta, ${source} A/B)`;
  const title = ciTitle(stats, target, source === "toggle" ? "ABBA quartets" : "pairs");
  const note = toggleCoverageNote(report);
  return num(deltaText(stats, OVERHEAD_UNITS.cpuRelative), {
    tone: VERDICT_DISPLAY[report.verdicts.cpu].tone,
    title: note == undefined ? title : `${title}; ${note}`,
  });
}

/**
 * Per-run KPI table: memory Δ of the scenario's latest overhead report (relaunch A/B), toned by the
 * memory verdict; `not measured` for method `toggle`.
 */
export function overheadMemCell(report: OverheadReport | undefined): Cell {
  if (report == undefined) {
    return num("—");
  }
  const memoryVerdict = report.verdicts.memory;
  if (memoryVerdict == undefined) {
    return num(MEM_NOT_MEASURED, { title: "method toggle: memory needs the relaunch A/B" });
  }
  const stats = report.metrics.memBytes;
  const target = `target ≤ ${fmtMiB(report.targets.memDeltaBytesMax, 0)} MiB (mean working set delta)`;
  return num(deltaText(stats, OVERHEAD_UNITS.memMiB), {
    tone: VERDICT_DISPLAY[memoryVerdict].tone,
    title: ciTitle(stats, target),
  });
}

/** CPU statistics cells (relative median [CI95], its IQR, percentage points). */
function cpuCells(stats: Pick<CpuVerdictStats, "cpuRelative" | "cpuPctPoints">): Cell[] {
  return [
    num(deltaText(stats.cpuRelative, OVERHEAD_UNITS.cpuRelative)),
    num(iqrText(stats.cpuRelative, OVERHEAD_UNITS.cpuRelative)),
    num(deltaText(stats.cpuPctPoints, OVERHEAD_UNITS.cpuPp)),
  ];
}

/** Statistics cells of the relaunch rows (UA-probe comparisons, informational relaunch CPU). */
function statsCells(summary: OverheadComparisonSummary, verdict: Verdict | undefined): Cell[] {
  const { metrics } = summary;
  return [
    ...cpuCells(metrics),
    num(deltaText(metrics.memBytes, OVERHEAD_UNITS.memMiB)),
    { html: verdictBadge(verdict) },
  ];
}

function relaunchConfigTitle(report: OverheadReport): string {
  return `relaunch: ${report.config.repeats} repeat(s), ${report.config.warmupRuns} warm-up run(s), arms ${report.config.arms.join(" / ")}`;
}

function pairsTitle(report: OverheadReport, cpu: CpuVerdictStats): string {
  if (cpu.source === "toggle" && report.toggle != undefined) {
    return `toggle: ${toggleConfigText(report.toggle)}, one launch; deltas per quartet (Σ on / Σ off − 1, linear drift cancels)`;
  }
  return relaunchConfigTitle(report);
}

/** Final verdicts: CPU from the CPU verdict source, memory from the relaunch A/B (if it ran). */
function mainRow(report: OverheadReport): Cell[] {
  const cpu = cpuVerdictStats(report);
  return [
    cell(report.scenarioId),
    cell(report.platform),
    cell(report.createdAtWall),
    cell(methodText(report)),
    num(cpuSamplesText(cpu), { title: pairsTitle(report, cpu) }),
    ...cpuCells(cpu),
    num(memDeltaText(report, OVERHEAD_UNITS.memMiB)),
    { html: verdictBadge(report.verdicts.overall) },
    cell(reportFlagsText(report)),
    cell(selfCostText(report.selfCost)),
    cell(mainThreadText(report.metrics)),
  ];
}

/**
 * Sub-row of the relaunch A/B when the toggle A/B gave the CPU verdict (method `both`): its CPU
 * delta is informational, its memory delta and verdict are the memory verdict's.
 */
function relaunchRow(report: OverheadReport): Cell[] {
  const verdict = report.relaunchVerdicts?.overall;
  return [
    cell("↳ relaunch A/B (CPU informational)", { title: report.scenarioId }),
    cell(report.platform),
    cell(""),
    cell("relaunch"),
    num(pairsText(report), { title: relaunchConfigTitle(report) }),
    ...statsCells(report, verdict),
    cell(overheadFlagsText(report)),
    cell(""),
    cell(""),
  ];
}

/** Sub-row of a UA-probe comparison (`on-noUa` arm, web). */
function uaRow(
  report: OverheadReport,
  label: string,
  summary: OverheadComparisonSummary,
  verdict: Verdict | undefined,
): Cell[] {
  return [
    cell(`↳ ${label}`, { title: report.scenarioId }),
    cell(report.platform),
    cell(""),
    cell("relaunch"),
    num(pairsText({ n: summary.n, excludedPairs: summary.excludedPairs })),
    ...statsCells(summary, verdict),
    cell(""),
    cell(""),
    cell(mainThreadText(summary.metrics)),
  ];
}

/**
 * Sub-row of the toggle A/B without the UA memory probe (second launch, web): its CPU delta and
 * verdict are informational (the probe's share is `toggle` − this).
 */
function toggleWithoutUaRow(report: OverheadReport, toggle: OverheadToggleSummaryV3): Cell[] {
  return [
    cell(`↳ ${TOGGLE_WITHOUT_UA_PROBE_LABEL}`, { title: report.scenarioId }),
    cell(report.platform),
    cell(""),
    cell("toggle"),
    num(cpuSamplesText(toggleCpuStats(toggle)), {
      title: `toggle: ${toggleConfigText(toggle)}, own launch with ?telemetry.uaMemory=off`,
    }),
    ...cpuCells(toggle.metrics),
    num(MEM_NOT_MEASURED),
    { html: verdictBadge(toggle.verdict) },
    cell(toggleFlagsText(toggle)),
    cell(""),
    cell(""),
  ];
}

/**
 * Sub-row of the benchmark FPS probe (own launch, telemetry off, only the rAF frame loop toggled):
 * harness cost, so no verdict; the flags show where the CPU lands per process type.
 */
function toggleFrameProbeRow(report: OverheadReport, toggle: OverheadToggleSummaryV3): Cell[] {
  return [
    cell(`↳ ${TOGGLE_FRAME_PROBE_LABEL}`, { title: report.scenarioId }),
    cell(report.platform),
    cell(""),
    cell("toggle"),
    num(cpuSamplesText(toggleCpuStats(toggle)), {
      title: `toggle: ${toggleConfigText(toggle)}, own launch with ?telemetry=off, rAF loop toggled`,
    }),
    ...cpuCells(toggle.metrics),
    num(MEM_NOT_MEASURED),
    { html: verdictBadge(undefined) },
    cell(`${toggleFlagsText(toggle)} · ${toggleProcessDeltasText(toggle)}`),
    cell(""),
    cell(""),
  ];
}

/**
 * Sub-row of the direct (JS only) CPU attribution: telemetry JS time of a profiled period relative
 * to the toggle off blocks' CPU, with its own verdict (never merged into the CPU verdict).
 */
function directAttributionRow(report: OverheadReport, section: DirectAttributionV3): Cell[] {
  const measured = section.status === "measured" ? section : undefined;
  return [
    cell(`↳ ${DIRECT_ATTRIBUTION_LABEL}`, { title: report.scenarioId }),
    cell(report.platform),
    cell(""),
    cell("direct"),
    num(directAttributionSamplesText(section), {
      title: `CDP Profiler of the renderer main thread after the toggle blocks, telemetry on; telemetry sources: ${section.config.telemetrySources.join(", ")}`,
    }),
    measured == undefined
      ? num(NONE)
      : num(directAttributionRelativeText(measured), { title: directAttributionText(measured) }),
    num(NONE),
    num(measured == undefined ? NONE : directAttributionPpText(measured)),
    num(MEM_NOT_MEASURED),
    { html: verdictBadge(measured?.verdict) },
    cell(directAttributionRowFlagsText(section)),
    cell(""),
    cell(""),
  ];
}

function reportRows(report: OverheadReport): Cell[][] {
  const rows = [mainRow(report)];
  if (report.directAttribution != undefined) {
    rows.push(directAttributionRow(report, report.directAttribution));
  }
  if (report.toggleWithoutUaProbe != undefined) {
    rows.push(toggleWithoutUaRow(report, report.toggleWithoutUaProbe));
  }
  if (report.toggleFrameProbe != undefined) {
    rows.push(toggleFrameProbeRow(report, report.toggleFrameProbe));
  }
  if (report.cpuVerdictSource === "toggle" && report.runs.length > 0) {
    rows.push(relaunchRow(report));
  }
  if (report.withoutUaProbe != undefined) {
    const { verdicts, ...summary } = report.withoutUaProbe;
    rows.push(uaRow(report, "without UA probe (on-noUa vs off)", summary, verdicts.overall));
  }
  if (report.uaCost != undefined) {
    rows.push(uaRow(report, "UA probe cost (on vs on-noUa)", report.uaCost, undefined));
  }
  return rows;
}

function runFileItem(run: OverheadRunV2): string {
  const label = `repeat ${run.repeat + 1} · ${run.arm}`;
  if (run.resultFile == undefined) {
    return `<li>${escapeHtml(label)}: not recorded</li>`;
  }
  const href = escapeHtml(`${RESULTS_HREF}${encodeURIComponent(run.resultFile)}`);
  return `<li>${escapeHtml(label)}: <a href="${href}">${escapeHtml(run.resultFile)}</a></li>`;
}

/**
 * Per report, the measured runs' result files: overhead A/B runs are left out of every scenario
 * view (scorecard, overview, runs, …), so this is their only entry point.
 */
function runFilesHtml(reports: readonly OverheadReport[]): string {
  return reports
    .filter((report) => report.runs.length > 0)
    .map(
      (report) =>
        `<details><summary class="muted">Run files: ${escapeHtml(report.scenarioId)} · ${escapeHtml(report.platform)} (${report.runs.length})</summary><ul>${report.runs.map(runFileItem).join("")}</ul></details>`,
    )
    .join("\n");
}

/**
 * Latest report per scenario × platform, with the UA-probe rows when that arm ran, followed by
 * links to the measured runs' result files.
 */
export function overheadTable(overheads: readonly OverheadReport[]): string {
  const latest = latestOverheads(overheads);
  if (latest.length === 0) {
    return `<p class="muted">No <code>overhead-*.json</code> found (run the overhead A/B, see the benchmark README).</p>`;
  }
  return `${renderTable(OVERHEAD_HEADERS, latest.flatMap(reportRows))}\n${runFilesHtml(latest)}`;
}
