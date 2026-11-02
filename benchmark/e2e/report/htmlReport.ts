// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Interim, self-contained HTML viewer of `*.benchmark-result.v1.json` (+ `overhead-*.json`) until
// the definitive results dashboard (planned as a follow-up) exists. Pure: the CLI
// (`htmlReportCli.ts`) does the file IO and passes the Chart.js UMD source through `loadChartJs`.

import { KPI_HEADERS, MIB, REGENERATE_COMMAND } from "./constants";
import { REPORT_CSS } from "./htmlReport.style";
import { Cell, Tone } from "./htmlReport.types";
import { REPORT_CLIENT_JS } from "./htmlReportAssets";
import {
  buildRunChartData,
  findOverhead,
  formatRunTime,
  latestOverheads,
  matchScreenshots,
  newestFinishedAtMs,
  runStem,
  selectRuns,
  staleHours,
} from "./htmlReportData";
import {
  HtmlReportInput,
  HtmlReportOptions,
  LoadedResult,
  RunChartData,
  ScreenshotLink,
} from "./types";
import type { BenchmarkResultV1, PanelSummaryV1, RunnerEventsSummaryV1 } from "../result/schemaV1";
import type { OverheadReport } from "../runner/types";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** JSON for a `<script type="application/json">` block: no `<` can close or open a tag. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** JavaScript source for an inline `<script>`: neutralizes `</script` and `<!--`. */
function scriptForInline(source: string): string {
  return source.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
}

/** Encodes a file name for an `href`/`src` (keeps it relative; HTML-escaped by the caller). */
function hrefFor(prefix: string, fileName: string): string {
  return `${prefix}${encodeURIComponent(fileName)}`;
}

function fmtNumber(value: number | undefined, digits = 0): string {
  return value == undefined || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
}

function fmtMiB(bytes: number | undefined, digits = 1): string {
  return bytes == undefined ? "—" : fmtNumber(bytes / MIB, digits);
}

function fmtMs(ms: number | undefined): string {
  return ms == undefined ? "—" : fmtNumber(ms, 0);
}

function fmtRatio(ratio: number | undefined): string {
  return ratio == undefined ? "—" : `${fmtNumber(ratio * 100, 1)} %`;
}

function cell(text: string, extra: Omit<Cell, "html"> = {}): Cell {
  return { html: escapeHtml(text), ...extra };
}

function num(text: string, extra: Omit<Cell, "html" | "numeric"> = {}): Cell {
  return { html: escapeHtml(text), numeric: true, ...extra };
}

function renderTable(
  headers: readonly string[],
  rows: readonly Cell[][],
  caption?: string,
): string {
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = row
        .map((entry) => {
          const classes = [entry.numeric === true ? "num" : "", entry.tone ?? ""].filter(Boolean);
          const classAttr = classes.length > 0 ? ` class="${classes.join(" ")}"` : "";
          const titleAttr = entry.title != undefined ? ` title="${escapeHtml(entry.title)}"` : "";
          return `<td${classAttr}${titleAttr}>${entry.html}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("\n");
  const captionHtml = caption != undefined ? `<h3>${escapeHtml(caption)}</h3>` : "";
  return `${captionHtml}<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>\n${body}\n</tbody></table></div>`;
}

function keyValueTable(caption: string, entries: readonly [string, string][]): string {
  return renderTable(
    ["Field", "Value"],
    entries.map(([key, value]) => [cell(key), cell(value)]),
    caption,
  );
}

function runnerEventCount(summary: RunnerEventsSummaryV1 | undefined): number | undefined {
  return summary == undefined
    ? undefined
    : Object.values(summary).reduce((sum, count) => sum + count, 0);
}

/** Every pool's invariant, or undefined when the run has no pool data. */
function poolInvariant(result: BenchmarkResultV1): boolean | undefined {
  const pools = Object.values(result.summary.hydratedSourcePool?.pools ?? {});
  return pools.length === 0 ? undefined : pools.every((pool) => pool.invariantHolds);
}

/** green: within target with margin; amber: within target but above 80 % of it; red: missed. */
function targetTone({ value, max, within }: { value: number; max: number; within: boolean }): Tone {
  if (!within) {
    return "bad";
  }
  return value > max * 0.8 ? "warn" : "good";
}

function overheadCpuCell(report: OverheadReport | undefined): Cell {
  if (report == undefined) {
    return num("—");
  }
  const relative = report.deltas.cpuDeltaRelative;
  const text =
    relative == undefined
      ? `${fmtNumber(report.deltas.cpuDeltaPctPoints, 2)} pp`
      : `${fmtNumber(relative * 100, 2)} %`;
  return num(text, {
    tone: targetTone({
      value: relative ?? 0,
      max: report.targets.cpuDeltaRelativeMax,
      within: report.within.cpu,
    }),
    title: `target ≤ ${fmtNumber(report.targets.cpuDeltaRelativeMax * 100, 0)} % (relative CPU delta)`,
  });
}

function overheadMemCell(report: OverheadReport | undefined): Cell {
  if (report == undefined) {
    return num("—");
  }
  return num(`${fmtMiB(report.deltas.memDeltaBytes, 1)} MiB`, {
    tone: targetTone({
      value: report.deltas.memDeltaBytes,
      max: report.targets.memDeltaBytesMax,
      within: report.within.memory,
    }),
    title: `target ≤ ${fmtMiB(report.targets.memDeltaBytesMax, 0)} MiB (mean working set delta)`,
  });
}

function runAnchor(index: number): string {
  return `run-${index}`;
}

function runTitle(result: BenchmarkResultV1): string {
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

function kpiRow(
  result: BenchmarkResultV1,
  index: number,
  overheads: readonly OverheadReport[],
  newestMs: number | undefined,
): Cell[] {
  const { summary, run } = result;
  const { phases, process, renderer, pipeline } = summary;
  const hasProcess = process.sampleCount > 0;
  const coverage = phases.panelsReadyCoverage;
  const invariant = poolInvariant(result);
  const events = runnerEventCount(summary.runnerEvents);
  const overhead = findOverhead(overheads, run.scenarioId, run.platform);
  return [
    { html: `<a href="#${runAnchor(index)}">${escapeHtml(run.scenarioId)}</a>` },
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
    num(fmtNumber(renderer.medianFps, 1)),
    num(fmtNumber(pipeline?.messagesPerSec, 0)),
    num(fmtMiB(pipeline?.bytesPerSec, 2)),
    num(fmtRatio(pipeline?.sourceCacheHitRatio)),
    invariant == undefined
      ? cell("—")
      : cell(invariant ? "✅" : "❌", { tone: invariant ? "good" : "bad" }),
    events == undefined ? num("—") : num(String(events), { tone: events > 0 ? "bad" : "good" }),
    overheadCpuCell(overhead),
    overheadMemCell(overhead),
  ];
}

function overheadTable(overheads: readonly OverheadReport[]): string {
  const latest = latestOverheads(overheads);
  if (latest.length === 0) {
    return `<p class="muted">No <code>overhead-*.json</code> found (run the overhead A/B, see the benchmark README).</p>`;
  }
  const rows = latest.map((report) => [
    cell(report.scenarioId),
    cell(report.platform),
    cell(report.createdAtWall),
    num(fmtNumber(report.off.medianTotalCpuPercent, 2)),
    num(fmtNumber(report.on.medianTotalCpuPercent, 2)),
    overheadCpuCell(report),
    num(fmtMiB(report.off.meanTotalWorkingSetBytes)),
    num(fmtMiB(report.on.meanTotalWorkingSetBytes)),
    overheadMemCell(report),
    cell(report.withinTargets ? "✅" : "❌", { tone: report.withinTargets ? "good" : "bad" }),
  ]);
  return renderTable(
    [
      "Scenario",
      "Platform",
      "Created",
      "CPU off %",
      "CPU on %",
      "CPU Δ (rel.)",
      "Mem off (MiB)",
      "Mem on (MiB)",
      "Mem Δ",
      "Within targets",
    ],
    rows,
  );
}

function panelRows(panels: Record<string, PanelSummaryV1>): Cell[][] {
  return Object.entries(panels)
    .sort(([a], [b]) => a.localeCompare(b))
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
      num(fmtNumber(panel.renders)),
      num(fmtNumber(panel.renderMeanMs, 2)),
      num(fmtNumber(panel.renderMaxMs, 2)),
      num(fmtNumber(panel.renderP90WindowMaxMs, 2)),
      num(fmtNumber(panel.skipped)),
    ]);
}

function panelsTable(result: BenchmarkResultV1): string {
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

function phasesTable(result: BenchmarkResultV1): string {
  const { phases } = result.summary;
  const coverage = phases.panelsReadyCoverage;
  return keyValueTable("Phases", [
    ["origin", phases.origin ?? "— (no origin event)"],
    ["layout applied (ms)", fmtMs(phases.layoutAppliedMs)],
    ["open duration (ms)", fmtMs(phases.openDurationMs)],
    ["first message (ms)", fmtMs(phases.firstMessageMs)],
    ["first useful frame (ms)", fmtMs(phases.firstUsefulFrameMs)],
    ["preload duration (ms)", fmtMs(phases.preloadDurationMs)],
    ["panels ready (ms)", fmtMs(phases.panelsReadyMs)],
    [
      "panels ready coverage",
      coverage == undefined
        ? "—"
        : `${coverage.firstRendered} first-rendered / ${coverage.mounted} mounted`,
    ],
  ]);
}

function pipelineTable(result: BenchmarkResultV1): string {
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

function processTable(result: BenchmarkResultV1): string {
  const { process, renderer } = result.summary;
  const rows: Cell[][] = Object.entries(process.byType)
    .sort(([a], [b]) => a.localeCompare(b))
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

function poolTable(result: BenchmarkResultV1): string {
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

function runnerEventsTable(result: BenchmarkResultV1): string {
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

function environmentTable(loaded: LoadedResult): string {
  const { run, dropped, sequenceGaps } = loaded.result;
  const env = run.environment;
  const sumValues = (record: Record<string, number>) =>
    Object.values(record).reduce((sum, value) => sum + value, 0);
  const entries: [string, string][] = [
    ["file", loaded.fileName],
    ["platform", run.platform],
    ["pipeline", run.pipeline],
    ["telemetry", run.telemetryEnabled ? "on" : "off"],
    ["started / finished", `${run.startedAtWall} / ${run.finishedAtWall}`],
    ["duration (s)", fmtNumber((run.endMonotonicTs - run.startMonotonicTs) / 1000, 1)],
    ["sample interval (ms)", fmtMs(run.sampleIntervalMs)],
    ["os / arch", `${env.os} / ${env.arch}`],
    ["CPU", env.cpuModel],
    ["memory (GiB)", fmtNumber(env.totalMemBytes / 1024 ** 3, 1)],
    ["CI", env.ci ? "yes" : "no"],
  ];
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
  chart: RunChartData,
  index: number,
  input: HtmlReportInput,
  newestMs: number | undefined,
): string {
  const { result } = loaded;
  const shots = matchScreenshots(runStem(loaded.fileName), input.screenshotFiles);
  const events = runnerEventCount(result.summary.runnerEvents) ?? 0;
  const failure = events > 0 ? ` <span class="bad">${events} runner event(s)</span>` : "";
  return `<details class="run" id="${runAnchor(index)}" data-run="${index}"${index === 0 ? " open" : ""}>
<summary>${escapeHtml(runTitle(result))} <span class="sub">— ${runTimeHtml(result.run.finishedAtWall, newestMs)}</span>${failure}</summary>
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
  const kpiRuns = runs
    .map((loaded, index) => ({ loaded, index }))
    .filter(({ loaded }) => loaded.result.run.telemetryEnabled);
  const telemetryOff = runs.length - kpiRuns.length;

  const meta = [
    `Generated ${input.generatedAtWall}`,
    input.git?.branch != undefined ? `branch ${input.git.branch}` : undefined,
    input.git?.commit != undefined ? `commit ${input.git.commit.slice(0, 12)}` : undefined,
    `${runs.length} run(s) shown${input.all ? " (all runs)" : " (latest per scenario × platform × telemetry mode)"}`,
    `${input.results.length} valid result file(s)`,
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
          kpiRuns.map(({ loaded, index }) =>
            kpiRow(loaded.result, index, input.overheads, newestMs),
          ),
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
<h2>Overview</h2>
<p class="muted">Telemetry-on runs; colors only where a target exists (overhead, runner events, pool invariant). Times are ms from the phases origin (<code>datasource.open</code>, else <code>app.ready</code>).${telemetryOff > 0 ? ` ${telemetryOff} telemetry-off run(s) are listed below only.` : ""}</p>
${kpiHtml}
<h2>Telemetry overhead</h2>
${overheadTable(input.overheads)}
<h2>Runs</h2>
${runs.length === 0 ? `<p class="muted">No valid <code>*.benchmark-result.v1.json</code> found.</p>` : runs.map((loaded, index) => runSection(loaded, charts[index]!, index, input, newestMs)).join("\n")}
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
