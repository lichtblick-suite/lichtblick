// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// "Scorecard" (one card per KPI family per platform, `aggregateKpis`) and "By group" (`groupKpis`)
// sections of the HTML viewer. Colors only where an explicit target exists (stability 100 %,
// telemetry overhead); everything else is neutral. Pure; every text is escaped here.

import {
  CPU_SCALE_NOTE,
  LEGACY_OVERHEAD_NOTE,
  MEM_NOT_MEASURED,
  PLATFORM_ORDER,
  VERDICT_DISPLAY,
} from "./constants";
import type { Tone } from "./htmlReport.types";
import { cell, escapeHtml, fmtNumber, num, renderTable } from "./htmlReportFormat";
import { LOW_FPS_WARNING, MIN_SLOPE_WINDOW_MS } from "../result/constants";
import { aggregateKpis, groupKpis } from "../result/kpis";
import type {
  GroupKpiValueV1,
  KpiAggregateV1,
  KpiRun,
  KpiRunRef,
  OverheadKpiInput,
  OverheadWorstV1,
  PlatformScorecardV1,
} from "../result/kpis.types";
import type { BenchmarkPlatform } from "../result/schemaV1";

type Card = { title: string; headline: string; lines: string[]; tone?: Tone };

function runLink(ref: KpiRunRef): string {
  return `<a href="#${escapeHtml(ref.runId)}">${escapeHtml(ref.scenarioId)}</a>`;
}

function valueText(value: number | undefined, digits: number, unit: string): string {
  const text = fmtNumber(value, digits);
  return value == undefined || unit === "" ? text : `${text} ${unit}`;
}

/** "n=2 · worst: <link> (value)" of an aggregate (escaped). */
function aggregateFooter(agg: KpiAggregateV1, digits: number, unit: string): string {
  const worst =
    agg.worst == undefined
      ? ""
      : ` · worst: ${runLink(agg.worst)} (${escapeHtml(valueText(agg.worst.value, digits, unit))})`;
  return `<span class="muted">n=${agg.n}${worst}</span>`;
}

/** One labelled aggregate line: "<label>: <value> <unit> (n=…, worst …)". */
function aggregateLine(label: string, agg: KpiAggregateV1, digits: number, unit: string): string {
  return `${escapeHtml(label)}: <b>${escapeHtml(valueText(agg.value, digits, unit))}</b> ${aggregateFooter(agg, digits, unit)}`;
}

function cardHtml(card: Card): string {
  const tone = card.tone == undefined ? "" : ` ${card.tone}`;
  const lines = card.lines.map((line) => `<li>${line}</li>`).join("");
  return `<div class="card kpi-card${tone}"><h4>${escapeHtml(card.title)}</h4><div class="kpi-value">${card.headline}</div><ul>${lines}</ul></div>`;
}

function stabilityCard(scorecard: PlatformScorecardV1): Card {
  const { healthy, total, unhealthy } = scorecard.stability;
  const percent = total === 0 ? undefined : (healthy / total) * 100;
  const lines = [`target 100 % healthy (passed, no runner events, pool invariant, no drops)`];
  if (unhealthy.length > 0) {
    lines.push(`unhealthy: ${unhealthy.map(runLink).join(", ")}`);
  }
  let tone: Tone | undefined;
  if (total > 0) {
    tone = healthy === total ? "good" : "bad";
  }
  return {
    title: "Stability",
    headline: `${healthy}/${total} healthy (${escapeHtml(valueText(percent, 0, "%"))})`,
    lines,
    tone,
  };
}

function memoryCard({ metrics }: PlatformScorecardV1): Card {
  const slope = metrics.workingSetSlopeMiBPerMin;
  const slopeLine =
    slope.n === 0
      ? `max working-set slope: — <span class="muted">(needs a steady window ≥ ${fmtNumber(MIN_SLOPE_WINDOW_MS / 1000, 0)} s)</span>`
      : aggregateLine("max working-set slope", slope, 1, "MiB/min");
  return {
    title: "Memory",
    headline: escapeHtml(valueText(metrics.peakTotalWorkingSetMiB.value, 0, "MiB")),
    lines: [
      `geomean of peak working set ${aggregateFooter(metrics.peakTotalWorkingSetMiB, 0, "MiB")}`,
      slopeLine,
    ],
  };
}

function cpuCard({ metrics }: PlatformScorecardV1): Card {
  return {
    title: "CPU",
    headline: escapeHtml(valueText(metrics.medianCpuPercent.value, 1, "%")),
    lines: [
      `geomean of median CPU ${aggregateFooter(metrics.medianCpuPercent, 1, "%")}`,
      aggregateLine("CPU s / MiB ingested (geomean)", metrics.cpuSecondsPerMiB, 3, "s/MiB"),
      `<span class="muted">${escapeHtml(CPU_SCALE_NOTE)}</span>`,
    ],
  };
}

function smoothnessCard(scorecard: PlatformScorecardV1): Card {
  const { metrics, lowFpsRuns } = scorecard;
  const lines = [
    `min median FPS ${aggregateFooter(metrics.medianFps, 1, "FPS")}`,
    aggregateLine("min % of ceiling", metrics.fpsPercentOfCeiling, 0, "%"),
    aggregateLine("min on-time frames", metrics.onTimeFramePercent, 1, "%"),
    aggregateLine("max long-task blocked", metrics.longTaskBlockedMsPerSec, 1, "ms/s"),
  ];
  if (lowFpsRuns.length > 0) {
    const links = lowFpsRuns
      .map((run) => `${runLink(run)} (${escapeHtml(fmtNumber(run.medianFps, 1))})`)
      .join(", ");
    lines.push(
      `<span class="low-fps">⚠ ${lowFpsRuns.length} run(s) below ${LOW_FPS_WARNING} FPS</span>: ${links}`,
    );
  }
  return {
    title: "Smoothness",
    headline: escapeHtml(valueText(metrics.medianFps.value, 1, "FPS")),
    lines,
  };
}

function startupCard({ metrics }: PlatformScorecardV1): Card {
  return {
    title: "Startup",
    headline: escapeHtml(valueText(metrics.panelsReadyMs.value, 0, "ms")),
    lines: [
      `geomean of panels ready ${aggregateFooter(metrics.panelsReadyMs, 0, "ms")}`,
      aggregateLine("first message (geomean)", metrics.firstMessageMs, 0, "ms"),
    ],
  };
}

function throughputCard({ metrics }: PlatformScorecardV1): Card {
  return {
    title: "Throughput",
    headline: escapeHtml(valueText(metrics.ingestMiBPerSec.value, 2, "MiB/s")),
    lines: [`geomean of pipeline ingest ${aggregateFooter(metrics.ingestMiBPerSec, 2, "MiB/s")}`],
  };
}

function renderCostCard({ renderCostByPanelType }: PlatformScorecardV1): Card {
  const entries = Object.entries(renderCostByPanelType);
  const worst = Math.max(...entries.map(([, agg]) => agg.value ?? -Infinity));
  const lines =
    entries.length === 0
      ? [`<span class="muted">no render telemetry (adapter panels only)</span>`]
      : entries.map(([type, agg]) => aggregateLine(`${type} p90`, agg, 1, "ms"));
  return {
    title: "Render cost",
    headline: escapeHtml(valueText(entries.length === 0 ? undefined : worst, 1, "ms")),
    lines,
  };
}

function overheadCard({ overhead }: PlatformScorecardV1): Card {
  if (overhead == undefined) {
    return {
      title: "Telemetry overhead",
      headline: "—",
      lines: [`<span class="muted">no overhead A/B report for this platform</span>`],
    };
  }
  const { worstCpuRelative: cpu, worstMemMiB: mem, targets } = overhead;
  const display = VERDICT_DISPLAY[overhead.verdict];
  const legacy =
    overhead.legacyReports > 0 ? ` · ${overhead.legacyReports} ${LEGACY_OVERHEAD_NOTE}` : "";
  const { toggle, relaunch } = overhead.cpuVerdictSources;
  const cpuSources = `CPU from toggle ${toggle} / relaunch ${relaunch}`;
  const memNote =
    overhead.memNotMeasuredReports > 0
      ? ` · ${overhead.memNotMeasuredReports} ${MEM_NOT_MEASURED} (method toggle)`
      : "";
  return {
    title: "Telemetry overhead",
    headline: escapeHtml(display.label),
    lines: [
      `worst CPU Δ CI95 upper: ${worstOverheadText(cpu, 100, 2, "%")} · target ≤ ${fmtNumber(targets.cpuDeltaRelativeMax * 100, 0)} %`,
      `worst memory Δ CI95 upper: ${worstOverheadText(mem, 1, 1, "MiB")} · target ≤ ${fmtNumber(targets.memDeltaMiBMax, 0)} MiB${escapeHtml(memNote)}`,
      `<span class="muted">${overhead.reports} scenario(s) · ≥ ${overhead.minPairs} pair(s) / quartet(s) each · ${escapeHtml(cpuSources)}${escapeHtml(legacy)} · <a href="#telemetry-overhead">details</a></span>`,
    ],
    tone: display.tone,
  };
}

/** `<b>+1.50 %</b> (median +1.00 %, scenario)` of the worst overhead scenario. */
function worstOverheadText(
  worst: OverheadWorstV1 | undefined,
  scale: number,
  digits: number,
  unit: string,
): string {
  if (worst == undefined) {
    return "<b>—</b>";
  }
  const upper = `<b>${escapeHtml(`${fmtNumber(worst.ciUpper * scale, digits)} ${unit}`)}</b>`;
  const median =
    worst.median == undefined
      ? ""
      : `median ${escapeHtml(`${fmtNumber(worst.median * scale, digits)} ${unit}`)}, `;
  return `${upper} (${median}${escapeHtml(worst.scenarioId)})`;
}

const CARDS: ReadonlyArray<(scorecard: PlatformScorecardV1) => Card> = [
  stabilityCard,
  memoryCard,
  cpuCard,
  smoothnessCard,
  startupCard,
  throughputCard,
  renderCostCard,
  overheadCard,
];

/** Platforms with telemetry-on runs or overhead reports, electron first. */
function shownPlatforms(
  runs: readonly KpiRun[],
  overheads: readonly OverheadKpiInput[],
): BenchmarkPlatform[] {
  return PLATFORM_ORDER.filter(
    (platform) =>
      runs.some((run) => run.result.run.platform === platform && run.result.run.telemetryEnabled) ||
      overheads.some((report) => report.platform === platform),
  );
}

/**
 * "Scorecard": per platform (never mixed), one card per KPI family with the aggregate over the
 * shown telemetry-on runs, n and a link to the worst run. `runs[].runId` is the run's anchor.
 */
export function scorecardHtml(
  runs: readonly KpiRun[],
  overheads: readonly OverheadKpiInput[],
): string {
  const platforms = shownPlatforms(runs, overheads);
  if (platforms.length === 0) {
    return `<p class="muted">No telemetry-on runs found.</p>`;
  }
  return platforms
    .map((platform) => {
      const scorecard = aggregateKpis(runs, platform, overheads);
      const cards = CARDS.map((build) => cardHtml(build(scorecard))).join("");
      return `<h3>${escapeHtml(platform)} <span class="muted">· ${scorecard.runs} run(s)</span></h3><div class="cards">${cards}</div>`;
    })
    .join("\n");
}

function groupValueHtml(kpi: GroupKpiValueV1): string {
  const { def } = kpi;
  const fallback =
    kpi.fallbackFor == undefined
      ? ""
      : ` <span class="muted" title="No run had a value for ${escapeHtml(kpi.fallbackFor)}">(fallback for ${escapeHtml(kpi.fallbackFor)})</span>`;
  return `${aggregateLine(def.label, kpi, def.digits, def.unit)} <span class="muted">[${def.policy.aggregate}]</span>${fallback}`;
}

/** "By group": scenario group × platform -> primary KPI, secondary KPIs, scenarios. */
export function byGroupHtml(runs: readonly KpiRun[]): string {
  const rows = PLATFORM_ORDER.flatMap((platform) => groupKpis(runs, platform));
  if (rows.length === 0) {
    return `<p class="muted">No telemetry-on runs with a recorded scenario group.</p>`;
  }
  return renderTable(
    ["Group", "Platform", "Runs", "Primary KPI", "Secondary KPIs", "Scenarios"],
    rows.map((row) => [
      cell(row.group),
      cell(row.platform),
      num(String(row.runs)),
      { html: groupValueHtml(row.primary) },
      { html: row.secondary.map(groupValueHtml).join("<br>") },
      cell(row.scenarios.join(", ")),
    ]),
  );
}
