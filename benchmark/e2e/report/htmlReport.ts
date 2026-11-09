// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Interim, self-contained HTML viewer of `*.benchmark-result.v1.json` (+ `overhead-*.json`) until
// the definitive results dashboard (planned as a follow-up) exists. Pure: the CLI
// (`htmlReportCli.ts`) does the file IO and passes the Chart.js UMD source through `loadChartJs`.

import {
  GL_BACKEND_KEYWORDS,
  HOST_CPU_SOURCE_LABELS,
  KPI_HEADERS,
  NOT_RECORDED,
  REGENERATE_COMMAND,
  SCENARIO_NOT_RECORDED,
} from "./constants";
import { REPORT_CSS } from "./htmlReport.style";
import { Cell } from "./htmlReport.types";
import { REPORT_CLIENT_JS } from "./htmlReportAssets";
import {
  buildRunChartData,
  findOverhead,
  formatRunTime,
  matchScreenshots,
  newestFinishedAtMs,
  runStem,
  selectRuns,
  staleHours,
} from "./htmlReportData";
import {
  coverageHtml,
  exercisesCardHtml,
  filterBarHtml,
  filterTokens,
  scenarioChipsHtml,
} from "./htmlReportExercises";
import type { ExercisedRun } from "./htmlReportExercises.types";
import {
  cell,
  escapeHtml,
  fmtMiB,
  fmtMs,
  fmtNumber,
  fmtRatio,
  keyValueTable,
  num,
  renderTable,
  runAnchor,
} from "./htmlReportFormat";
import { overheadCpuCell, overheadMemCell, overheadTable } from "./htmlReportOverhead";
import { byGroupHtml, scorecardHtml } from "./htmlReportScorecard";
import {
  HtmlReportInput,
  HtmlReportOptions,
  LoadedResult,
  RunChartData,
  ScreenshotLink,
} from "./types";
import {
  LOW_FPS_WARNING,
  MIN_PAIRS_FOR_VERDICT,
  MIN_QUARTETS_FOR_VERDICT,
} from "../result/constants";
import { exercisedComponents } from "../result/exercised";
import type { KpiRun } from "../result/kpis.types";
import { isOverheadRun } from "../result/runMode";
import type { PanelSummaryV1, PersistedResultV1, RunnerEventsSummaryV1 } from "../result/schemaV1";
import type { OverheadReport } from "../runner/overhead.types";
import { compareCodeUnits } from "../shared/compare";

/** JSON for a `<script type="application/json">` block: no `<` can close or open a tag. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", String.raw`\u003c`)
    .replaceAll("\u2028", String.raw`\u2028`)
    .replaceAll("\u2029", String.raw`\u2029`);
}

/** JavaScript source for an inline `<script>`: neutralizes `</script` and `<!--`. */
function scriptForInline(source: string): string {
  return source.replace(/<\/(script)/gi, String.raw`<\/$1`).replaceAll("<!--", String.raw`<\!--`);
}

/** Encodes a file name for an `href`/`src` (keeps it relative; HTML-escaped by the caller). */
function hrefFor(prefix: string, fileName: string): string {
  return `${prefix}${encodeURIComponent(fileName)}`;
}

function runnerEventCount(summary: RunnerEventsSummaryV1 | undefined): number | undefined {
  return summary == undefined
    ? undefined
    : Object.values(summary).reduce((sum, count) => sum + count, 0);
}

/** Every pool's invariant, or undefined when the run has no pool data. */
function poolInvariant(result: PersistedResultV1): boolean | undefined {
  const pools = Object.values(result.summary.hydratedSourcePool?.pools ?? {});
  return pools.length === 0 ? undefined : pools.every((pool) => pool.invariantHolds);
}

/** green: within target with margin; amber: within target but above 80 % of it; red: missed. */
/** Pool invariant verdict of a run: ✅/❌, or a dash without pool data. */
function poolInvariantCell(result: PersistedResultV1): Cell {
  const invariant = poolInvariant(result);
  if (invariant == undefined) {
    return cell("—");
  }
  return cell(invariant ? "✅" : "❌", { tone: invariant ? "good" : "bad" });
}

/** Runner event count (red when any), or a dash when the run has no runner event summary. */
function runnerEventsCell(events: number | undefined): Cell {
  if (events == undefined) {
    return num("—");
  }
  return num(String(events), { tone: events > 0 ? "bad" : "good" });
}

function runTitle(result: PersistedResultV1): string {
  const { scenarioId, platform, telemetryEnabled } = result.run;
  return `${scenarioId} · ${platform}${telemetryEnabled ? "" : " · telemetry off"}`;
}

/** Grey run time plus a "stale" hint when the run is > 24 h older than the newest run shown. */
function runTimeHtml(finishedAtWall: string, newestMs: number | undefined): string {
  const time = `<span class="muted nowrap" title="${escapeHtml(finishedAtWall)}">${escapeHtml(formatRunTime(finishedAtWall))}</span>`;
  const hours = staleHours(finishedAtWall, newestMs);
  if (hours == undefined) {
    return time;
  }
  const age = hours >= 48 ? `${fmtNumber(hours / 24, 0)} d` : `${fmtNumber(hours, 0)} h`;
  return `${time} <span class="stale" title="Finished ${age} before the newest run in this report: rerun it for comparable data">stale</span>`;
}

/** Short GL backend of the GL renderer string (`GL_BACKEND_KEYWORDS`), full string as title. */
function glBackendCell(glRenderer: string | undefined): Cell {
  if (glRenderer == undefined || glRenderer === "") {
    return cell("—");
  }
  const lower = glRenderer.toLowerCase();
  const backend = GL_BACKEND_KEYWORDS.find((keyword) => lower.includes(keyword.toLowerCase()));
  return cell(backend ?? "other", { title: glRenderer });
}

/** "median / ceiling" FPS (the median is always shown when frames exist); ⚠ when low. */
function fpsCell(result: PersistedResultV1): Cell {
  const { smoothness } = result.summary.kpis;
  const median = fmtNumber(smoothness.medianFps, 1);
  const text =
    smoothness.fpsCeiling == undefined
      ? median
      : `${median} / ${fmtNumber(smoothness.fpsCeiling, 0)}`;
  if (!smoothness.lowFps) {
    return num(text);
  }
  return {
    html: `<span class="low-fps">⚠</span> ${escapeHtml(text)}`,
    numeric: true,
    title: "median FPS below the low-FPS warning (informational)",
  };
}

function overviewScenarioCell(loaded: ExercisedRun): Cell {
  const { run } = loaded.result;
  return {
    html: `<a href="#${runAnchor(loaded.index)}">${escapeHtml(run.scenarioId)}</a>${scenarioChipsHtml(loaded.result, loaded.exercised)}`,
  };
}

function kpiRow(
  loaded: ExercisedRun,
  overheads: readonly OverheadReport[],
  newestMs: number | undefined,
): Cell[] {
  const { result } = loaded;
  const { summary, run } = result;
  const { phases, process, renderer, pipeline } = summary;
  const hasProcess = process.sampleCount > 0;
  const coverage = phases.panelsReadyCoverage;
  const events = runnerEventCount(summary.runnerEvents);
  const overhead = findOverhead(overheads, run.scenarioId, run.platform);
  return [
    overviewScenarioCell(loaded),
    cell(run.platform),
    { html: runTimeHtml(run.finishedAtWall, newestMs) },
    num(hasProcess ? fmtMiB(process.peakTotalWorkingSetBytes) : "—"),
    num(hasProcess ? fmtNumber(process.medianTotalCpuPercent, 1) : "—"),
    num(fmtMiB(renderer.peakJsHeapUsedBytes)),
    num(fmtMs(phases.firstMessageMs)),
    num(fmtMs(phases.firstUsefulFrameMs)),
    num(fmtMs(phases.layoutAppliedMs)),
    num(fmtMs(phases.panelsReadyMs), {
      title:
        coverage == undefined
          ? undefined
          : `${coverage.firstRendered}/${coverage.mounted} mounted panels emitted panel.firstRender`,
    }),
    fpsCell(result),
    glBackendCell(run.environment.glRenderer),
    num(fmtNumber(pipeline?.messagesPerSec, 0)),
    num(fmtMiB(pipeline?.bytesPerSec, 2)),
    num(fmtRatio(pipeline?.sourceCacheHitRatio)),
    poolInvariantCell(result),
    runnerEventsCell(events),
    overheadCpuCell(overhead),
    overheadMemCell(overhead),
  ];
}

function panelRows(panels: Record<string, PanelSummaryV1>): Cell[][] {
  return Object.entries(panels)
    .sort(([a], [b]) => compareCodeUnits(a, b))
    .map(([panelId, panel]) => [
      cell(panelId),
      cell(panel.panelType),
      num(String(panel.mounts)),
      num(fmtMs(panel.mountedAtMs)),
      num(fmtMs(panel.firstRenderMs)),
      num(fmtNumber(panel.messages)),
      num(fmtMiB(panel.messageBytes, 2)),
      num(fmtNumber(panel.rangeMessages)),
      num(fmtMiB(panel.rangeBytes, 2)),
      num(fmtNumber(panel.renderedMessages)),
      num(fmtMiB(panel.renderedBytes, 2)),
      num(fmtNumber(panel.renders)),
      num(fmtNumber(panel.renderMeanMs, 2)),
      num(fmtNumber(panel.renderMaxMs, 2)),
      num(fmtNumber(panel.renderP90WindowMaxMs, 2)),
      num(fmtNumber(panel.skipped)),
    ]);
}

function panelsTable(result: PersistedResultV1): string {
  const panels = result.summary.panels;
  if (panels == undefined || Object.keys(panels).length === 0) {
    return `<h3>Panels</h3><p class="muted">No panel telemetry.</p>`;
  }
  return renderTable(
    [
      "Panel",
      "Type",
      "Mounts",
      "Mounted (ms)",
      "First render (ms)",
      "Messages",
      "MiB",
      "Range msgs",
      "Range MiB",
      "Rendered msgs",
      "Rendered MiB",
      "Renders",
      "Render mean (ms)",
      "Render max (ms)",
      "p90 window max (ms)",
      "Skipped",
    ],
    panelRows(panels),
    "Panels",
  );
}

function phasesTable(result: PersistedResultV1): string {
  const { phases } = result.summary;
  const coverage = phases.panelsReadyCoverage;
  return keyValueTable("Phases", [
    ["origin", phases.origin ?? "— (no origin event)"],
    ["layout applied (ms)", fmtMs(phases.layoutAppliedMs)],
    ["open duration (ms)", fmtMs(phases.openDurationMs)],
    ["first message (ms)", fmtMs(phases.firstMessageMs)],
    ["first useful frame (ms)", fmtMs(phases.firstUsefulFrameMs)],
    [
      "preload duration (ms)",
      phases.preloadEndReason == undefined
        ? fmtMs(phases.preloadDurationMs)
        : `— (${phases.preloadEndReason})`,
    ],
    ["panels ready (ms)", fmtMs(phases.panelsReadyMs)],
    [
      "panels ready coverage",
      coverage == undefined
        ? "—"
        : `${coverage.firstRendered} first-rendered / ${coverage.mounted} mounted`,
    ],
  ]);
}

function pipelineTable(result: PersistedResultV1): string {
  const pipeline = result.summary.pipeline;
  if (pipeline == undefined) {
    return `<h3>Pipeline</h3><p class="muted">No pipeline telemetry.</p>`;
  }
  const entries: [string, string][] = [
    ["messages received", fmtNumber(pipeline.messagesReceived)],
    ["MiB received", fmtMiB(pipeline.bytesReceived, 2)],
    ["msg/s", fmtNumber(pipeline.messagesPerSec, 1)],
    ["MiB/s", fmtMiB(pipeline.bytesPerSec, 3)],
    ["rate window (ms)", fmtMs(pipeline.rateWindowMs)],
    ["delivered fanout", fmtNumber(pipeline.deliveredFanout, 2)],
    [
      "subscribers / subscriptions (max)",
      `${fmtNumber(pipeline.subscribersMax)} / ${fmtNumber(pipeline.subscriptionsMax)}`,
    ],
    [
      "listener dispatch mean / max / p90 window max (ms)",
      `${fmtNumber(pipeline.listenerDispatchMeanMs, 3)} / ${fmtNumber(pipeline.listenerDispatchMaxMs, 3)} / ${fmtNumber(pipeline.listenerDispatchP90WindowMaxMs, 3)}`,
    ],
    [
      "block cache peak / max (MiB)",
      `${fmtMiB(pipeline.blockCachePeakBytes)} / ${fmtMiB(pipeline.blockCacheMaxBytes)}`,
    ],
    ["block cache evictions", fmtNumber(pipeline.blockCacheEvictions)],
    [
      "source cache hits / misses (ratio)",
      `${fmtNumber(pipeline.sourceCacheHits)} / ${fmtNumber(pipeline.sourceCacheMisses)} (${fmtRatio(pipeline.sourceCacheHitRatio)})`,
    ],
    ["source cache peak (MiB)", fmtMiB(pipeline.sourceCachePeakBytes)],
    [
      "remote reads / MiB read",
      `${fmtNumber(pipeline.remoteReadRequests)} / ${fmtMiB(pipeline.remoteBytesRead, 2)}`,
    ],
    [
      "sources total / relevant",
      `${fmtNumber(pipeline.sourcesTotal)} / ${fmtNumber(pipeline.sourcesRelevant)}`,
    ],
  ];
  for (const [key, bytes] of Object.entries(pipeline.memoryPeakBytes ?? {})) {
    entries.push([`memory peak ${key} (MiB)`, fmtMiB(bytes, 2)]);
  }
  return keyValueTable(
    "Pipeline",
    entries.filter(([, value]) => value.replace(/[—/() ]/g, "") !== ""),
  );
}

function processTable(result: PersistedResultV1): string {
  const { process, renderer } = result.summary;
  const rows: Cell[][] = Object.entries(process.byType)
    .sort(([a], [b]) => compareCodeUnits(a, b))
    .map(([type, stats]) => [
      cell(type),
      num(fmtMiB(stats.peakWorkingSetBytes)),
      num(fmtNumber(stats.medianCpuPercent, 1)),
    ]);
  rows.push([
    cell("total"),
    num(process.sampleCount > 0 ? fmtMiB(process.peakTotalWorkingSetBytes) : "—"),
    num(process.sampleCount > 0 ? fmtNumber(process.medianTotalCpuPercent, 1) : "—"),
  ]);
  const table = renderTable(
    ["Process type", "Peak working set (MiB)", "Median CPU %"],
    rows,
    "Processes",
  );
  const rendererTable = keyValueTable("Renderer", [
    ["peak JS heap (MiB)", fmtMiB(renderer.peakJsHeapUsedBytes)],
    ["median FPS", fmtNumber(renderer.medianFps, 1)],
    ["late frames", fmtNumber(renderer.lateFrames)],
    ["long tasks", fmtNumber(renderer.longTasks)],
  ]);
  return table + rendererTable;
}

function poolTable(result: PersistedResultV1): string {
  const pools = Object.entries(result.summary.hydratedSourcePool?.pools ?? {});
  if (pools.length === 0) {
    return "";
  }
  const rows = pools.map(([key, pool]) => [
    cell(key),
    cell(pool.invariantHolds ? "✅" : "❌", { tone: pool.invariantHolds ? "good" : "bad" }),
    num(fmtNumber(pool.acquires)),
    num(fmtNumber(pool.releases)),
    num(fmtNumber(pool.terminatedPins)),
    num(fmtNumber(pool.activePinsFinal)),
    num(fmtNumber(pool.highWaterResidentCount)),
    num(fmtNumber(pool.highWaterActivePins)),
    num(fmtNumber(pool.evictions)),
    num(fmtNumber(pool.rehydrations)),
    num(fmtNumber(pool.overBudgetPeriods)),
  ]);
  return renderTable(
    [
      "Pool",
      "Invariant",
      "Acquires",
      "Releases",
      "Terminated pins",
      "Active pins (final)",
      "HW resident",
      "HW pins",
      "Evictions",
      "Rehydrations",
      "Over-budget periods",
    ],
    rows,
    "HydratedSourcePool",
  );
}

function runnerEventsTable(result: PersistedResultV1): string {
  const counts = result.summary.runnerEvents;
  const list = result.runnerEvents ?? [];
  const countsHtml =
    counts == undefined
      ? `<h3>Runner events</h3><p class="muted">Not recorded (older result).</p>`
      : renderTable(
          ["Type", "Count"],
          Object.entries(counts).map(([type, count]) => [
            cell(type),
            num(String(count), { tone: count > 0 ? "bad" : undefined }),
          ]),
          "Runner events",
        );
  if (list.length === 0) {
    return countsHtml;
  }
  const startTs = result.run.startMonotonicTs;
  const listHtml = renderTable(
    ["Type", "At (s from run start)", "Process", "Reason", "Exit code", "URL"],
    list.map((event) => [
      cell(event.type, { tone: "bad" }),
      num(fmtNumber((event.monotonicTs - startTs) / 1000, 2)),
      cell(event.processType ?? "—"),
      cell(event.reason ?? "—"),
      num(event.exitCode == undefined ? "—" : String(event.exitCode)),
      cell(event.url ?? "—"),
    ]),
  );
  return countsHtml + listHtml;
}

function healthText(result: PersistedResultV1): string {
  const { healthy, reasons } = result.summary.kpis.stability;
  return healthy ? "yes" : `no: ${reasons.join("; ")}`;
}

function worstPanelText(renderCost: PersistedResultV1["summary"]["kpis"]["renderCost"]): string {
  if (renderCost.worstPanelP90RenderMs == undefined) {
    return "—";
  }
  return `${fmtNumber(renderCost.worstPanelP90RenderMs, 1)} (${renderCost.worstPanelId ?? "?"})`;
}

/** The run's `summary.kpis`, with a note when the viewer recomputed them (older result). */
function runKpisTable(result: PersistedResultV1): string {
  const { kpis } = result.summary;
  const { memory, cpu, smoothness, startup, throughput } = kpis;
  const slope =
    memory.workingSetSlopeMiBPerMin == undefined
      ? "— (steady window too short)"
      : fmtNumber(memory.workingSetSlopeMiBPerMin, 2);
  const table = keyValueTable("KPIs", [
    ["healthy", healthText(result)],
    ["peak working set (MiB)", fmtNumber(memory.peakTotalWorkingSetMiB, 0)],
    ["working-set slope (MiB/min)", slope],
    ["median CPU %", fmtNumber(cpu.medianCpuPercent, 1)],
    [
      "CPU seconds / per MiB ingested",
      `${fmtNumber(cpu.cpuSeconds, 2)} / ${fmtNumber(cpu.cpuSecondsPerMiB, 3)}`,
    ],
    [
      "median FPS / ceiling",
      `${fmtNumber(smoothness.medianFps, 1)} / ${fmtNumber(smoothness.fpsCeiling, 1)}`,
    ],
    ["FPS % of ceiling", fmtNumber(smoothness.fpsPercentOfCeiling, 0)],
    ["on-time frames %", fmtNumber(smoothness.onTimeFramePercent, 1)],
    ["long-task blocked (ms/s)", fmtNumber(smoothness.longTaskBlockedMsPerSec, 1)],
    [
      "panels ready / first message (ms)",
      `${fmtMs(startup.panelsReadyMs)} / ${fmtMs(startup.firstMessageMs)}`,
    ],
    [
      "ingest MiB/s / msg/s / fanout",
      `${fmtNumber(throughput.ingestMiBPerSec, 2)} / ${fmtNumber(throughput.messagesPerSec, 0)} / ${fmtNumber(throughput.fanout, 2)}`,
    ],
    ["worst panel p90 render (ms)", worstPanelText(kpis.renderCost)],
  ]);
  const note =
    kpis.recomputed === true
      ? `<p class="muted recomputed">recomputed: this result predates <code>summary.kpis</code>; the viewer derived them from its summaries.</p>`
      : "";
  return table + note;
}

/** "<group>: <description>" of `run.scenario`, or a note for results that lack it. */
function scenarioLabel(scenario: PersistedResultV1["run"]["scenario"]): string {
  return scenario == undefined
    ? SCENARIO_NOT_RECORDED
    : `${scenario.group}: ${scenario.description}`;
}

function environmentTable(loaded: LoadedResult): string {
  const { run, dropped, sequenceGaps } = loaded.result;
  const env = run.environment;
  const sumValues = (record: Record<string, number>) =>
    Object.values(record).reduce((sum, value) => sum + value, 0);
  const entries: [string, string][] = [
    ["file", loaded.fileName],
    ["scenario", scenarioLabel(run.scenario)],
    ["platform", run.platform],
    ["pipeline", run.pipeline],
    ["telemetry", run.telemetryEnabled ? "on" : "off"],
    ["started / finished", `${run.startedAtWall} / ${run.finishedAtWall}`],
    ["duration (s)", fmtNumber((run.endMonotonicTs - run.startMonotonicTs) / 1000, 1)],
    ["sample interval (ms)", fmtMs(run.sampleIntervalMs)],
    ["os / arch", `${env.os} / ${env.arch}`],
    ["CPU", env.cpuModel],
    ["logical CPUs", env.logicalCpus == undefined ? NOT_RECORDED : String(env.logicalCpus)],
    ["memory (GiB)", fmtNumber(env.totalMemBytes / 1024 ** 3, 1)],
    ["CI", env.ci ? "yes" : "no"],
  ];
  if (env.hostCpuSource != undefined) {
    entries.push(["host CPU source", HOST_CPU_SOURCE_LABELS[env.hostCpuSource]]);
  }
  if (env.electronVersion != undefined) {
    entries.push(["Electron", env.electronVersion]);
  }
  if (env.chromiumVersion != undefined) {
    entries.push(["Chromium", env.chromiumVersion]);
  }
  if (env.userAgent != undefined) {
    entries.push(["user agent", env.userAgent]);
  }
  if (env.crossOriginIsolated != undefined) {
    entries.push(["cross-origin isolated", String(env.crossOriginIsolated)]);
  }
  entries.push(
    [
      "fps ceiling (measured)",
      env.fpsCeiling == undefined ? NOT_RECORDED : fmtNumber(env.fpsCeiling, 1),
    ],
    ["GL renderer", env.glRenderer ?? NOT_RECORDED],
    [
      "late-frame threshold (ms)",
      env.lateFrameThresholdMs == undefined ? NOT_RECORDED : fmtNumber(env.lateFrameThresholdMs, 2),
    ],
    [
      "samples / events",
      `${fmtNumber(loaded.result.samples.length)} / ${fmtNumber(loaded.result.events.length)}`,
    ],
    ["dropped records / sequence gaps", `${sumValues(dropped)} / ${sumValues(sequenceGaps)}`],
  );
  return keyValueTable("Environment", entries);
}

function screenshotsHtml(shots: readonly ScreenshotLink[], hrefPrefix: string): string {
  if (shots.length === 0) {
    return `<p class="muted">No screenshot matched this run; see the <a href="${escapeHtml(hrefPrefix)}">screenshots folder</a>.</p>`;
  }
  const figures = shots
    .map((shot) => {
      const href = escapeHtml(hrefFor(hrefPrefix, shot.fileName));
      const label = escapeHtml(shot.checkpoint);
      return `<figure><a href="${href}" target="_blank" rel="noopener"><img src="${href}" alt="${label} screenshot" loading="lazy"></a><figcaption>${label}</figcaption></figure>`;
    })
    .join("");
  return `<div class="shots">${figures}</div>`;
}

function markersHtml(chart: RunChartData): string {
  if (chart.markers.length === 0) {
    return "";
  }
  const items = chart.markers
    .map((marker) => {
      const text = `${marker.label} ${fmtNumber(marker.x, 2)} s`;
      return marker.kind === "failure"
        ? `<span class="bad">${escapeHtml(text)}</span>`
        : `<span>${escapeHtml(text)}</span>`;
    })
    .join("");
  return `<p class="markers muted">Markers (s from ${escapeHtml(chart.originLabel)}): ${items}</p>`;
}

function runSection(
  loaded: LoadedResult,
  run: ExercisedRun,
  chart: RunChartData,
  input: HtmlReportInput,
  newestMs: number | undefined,
): string {
  const { result } = loaded;
  const { index } = run;
  const shots = matchScreenshots(runStem(loaded.fileName), input.screenshotFiles);
  const events = runnerEventCount(result.summary.runnerEvents) ?? 0;
  const failure = events > 0 ? ` <span class="bad">${events} runner event(s)</span>` : "";
  const tags = escapeHtml(filterTokens(result).join(" "));
  return `<details class="run" id="${runAnchor(index)}" data-run="${index}" data-tags="${tags}"${index === 0 ? " open" : ""}>
<summary>${escapeHtml(runTitle(result))} <span class="sub">— ${runTimeHtml(result.run.finishedAtWall, newestMs)}</span>${failure}</summary>
${exercisesCardHtml(result, run.exercised)}
${runKpisTable(result)}
<div class="charts" id="charts-${index}"></div>
${markersHtml(chart)}
<h3>Screenshots</h3>
${screenshotsHtml(shots, input.screenshotsHref)}
${panelsTable(result)}
<div class="tables"><div>${phasesTable(result)}</div><div>${pipelineTable(result)}</div><div>${processTable(result)}</div></div>
${poolTable(result)}
${runnerEventsTable(result)}
${environmentTable(loaded)}
</details>`;
}

/** Builds the complete, offline HTML report (Chart.js inlined; data in a JSON script block). */
export function buildHtmlReport(input: HtmlReportInput, options: HtmlReportOptions): string {
  const runs = selectRuns(input.results, { all: input.all });
  const newestMs = newestFinishedAtMs(runs);
  const overheadRunFiles = input.results.filter(({ result }) => isOverheadRun(result)).length;
  const exercisedRuns: ExercisedRun[] = runs.map((loaded, index) => ({
    index,
    result: loaded.result,
    exercised: exercisedComponents(loaded.result),
  }));
  const kpiRuns = exercisedRuns.filter(({ result }) => result.run.telemetryEnabled);
  const telemetryOff = runs.length - kpiRuns.length;
  const scoredRuns: KpiRun[] = kpiRuns.map(({ index, result }) => ({
    runId: runAnchor(index),
    result,
  }));

  const meta = [
    `Generated ${input.generatedAtWall}`,
    input.git?.branch != undefined ? `branch ${input.git.branch}` : undefined,
    input.git?.commit != undefined ? `commit ${input.git.commit.slice(0, 12)}` : undefined,
    `${runs.length} run(s) shown${input.all ? " (all runs)" : " (latest per scenario × platform × telemetry mode)"}`,
    `${input.results.length} valid result file(s)`,
    overheadRunFiles > 0
      ? `${overheadRunFiles} overhead A/B run file(s) (telemetry overhead section only)`
      : undefined,
    input.skipped.length > 0 ? `${input.skipped.length} invalid file(s) skipped` : undefined,
  ].filter((entry): entry is string => entry != undefined);

  const skippedHtml =
    input.skipped.length === 0
      ? ""
      : `<details><summary class="muted">Skipped files</summary><ul>${input.skipped
          .map(
            (entry) =>
              `<li><code>${escapeHtml(entry.fileName)}</code>: ${escapeHtml(entry.reason)}</li>`,
          )
          .join("")}</ul></details>`;

  const kpiHtml =
    kpiRuns.length === 0
      ? `<p class="muted">No telemetry-on runs found.</p>`
      : renderTable(
          KPI_HEADERS,
          kpiRuns.map((run) => kpiRow(run, input.overheads, newestMs)),
          undefined,
          kpiRuns.map(({ result }) => ({ "data-tags": filterTokens(result).join(" ") })),
        );

  const charts = runs.map((loaded) => buildRunChartData(loaded.result));
  const data = { runs: charts.map((chart) => ({ chart })) };

  const chartJs = scriptForInline(options.loadChartJs());

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lichtblick benchmark report</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<header>
<h1>Lichtblick benchmark report</h1>
<p class="meta">${meta.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("")}</p>
${skippedHtml}
</header>
<main>
<h2 id="scorecard">Scorecard</h2>
<p class="muted">Shown telemetry-on runs per platform (electron and web are never aggregated together). Geometric mean for magnitudes, worst case for slope, smoothness, render cost and overhead; n = runs with a value. Colors only where a target exists (stability, overhead).</p>
${scorecardHtml(scoredRuns, input.overheads)}
<h2 id="by-group">By group</h2>
${byGroupHtml(scoredRuns)}
<h2 id="overview">Overview</h2>
${filterBarHtml(runs.map((loaded) => loaded.result))}
<p class="muted">Telemetry-on runs; colors only where a target exists (overhead, runner events, pool invariant). Times are ms from the phases origin (<code>datasource.open</code>, else <code>app.ready</code>). FPS: median / measured ceiling (⚠ below ${LOW_FPS_WARNING} FPS).${telemetryOff > 0 ? ` ${telemetryOff} telemetry-off run(s) are listed below only.` : ""}</p>
${kpiHtml}
<h2 id="coverage">Coverage</h2>
${coverageHtml(exercisedRuns)}
<h2 id="telemetry-overhead">Telemetry overhead</h2>
<p class="muted">Telemetry on − off. CPU from the in-process toggle A/B when it ran: one launch, telemetry switched off / on in ABBA quartets of blocks (off, on, on, off), one delta per quartet (Σ on / Σ off − 1, which cancels a linear CPU drift). Memory (and CPU with method relaunch) from pairs of fresh app instances (balanced order), steady window only. Median of the quartet / pair deltas with an exact, distribution-free order-statistic CI95 (binomial ranks; none below ${MIN_PAIRS_FOR_VERDICT} samples); verdict: <b>within</b> when the CI95 upper bound is ≤ the target, <b>exceeds</b> when the lower bound is above it, else <b>inconclusive</b> (also with fewer than ${MIN_QUARTETS_FOR_VERDICT} quartets / ${MIN_PAIRS_FOR_VERDICT} pairs). Report only unless <code>BENCHMARK_OVERHEAD_GATE=1</code>. Self-cost is the page's own timing of its telemetry (a lower bound: GC and memory pressure are not included).</p>
${overheadTable(input.overheads)}
<h2 id="runs">Runs</h2>
${runs.length === 0 ? `<p class="muted">No valid <code>*.benchmark-result.v1.json</code> found.</p>` : runs.map((loaded, index) => runSection(loaded, exercisedRuns[index]!, charts[index]!, input, newestMs)).join("\n")}
</main>
<footer>
<p>Interim viewer for <code>*.benchmark-result.v1.json</code>; the definitive results dashboard is planned as a follow-up.</p>
<p>Regenerate with <code>${escapeHtml(REGENERATE_COMMAND)}</code> (<code>--all</code>: every run, <code>--dir &lt;path&gt;</code>: other artifacts folder, <code>--open</code>: open in the browser).</p>
</footer>
<script type="application/json" id="report-data">${jsonForScript(data)}</script>
<script>${chartJs}</script>
<script>${REPORT_CLIENT_JS}</script>
</body>
</html>
`;
}
