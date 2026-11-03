// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import fs from "node:fs";
import path from "node:path";

import {
  buildExercisesLines,
  buildOverheadTable,
  buildPanelsSection,
  buildResultsTable,
  buildScorecardTable,
} from "../report/summaryMarkdown";
import { OVERHEAD_PREFIX, RESULT_V1_SUFFIX } from "../result/constants";
import { withRunKpis } from "../result/kpis";
import { normalizeOverheadReport } from "../result/overheadLegacy";
import { scenarioRunsOnly } from "../result/runMode";
import type { PersistedResultV1, StoredResultV1 } from "../result/schemaV1";
import type { OverheadReport } from "../runner/overhead.types";
import type { BenchmarkArtifact } from "../types";

// Copied rather than imported from `e2e/ci-helpers/types.ts`: kept local since this report only
// needs pass/fail/duration, and importing that module would re-run its own `main()` side effect.
type PlaywrightTestResult = { status: string; duration: number };
type PlaywrightTest = { results: PlaywrightTestResult[] };
type PlaywrightSpec = { title: string; tests: PlaywrightTest[] };
type PlaywrightSuite = { title: string; specs: PlaywrightSpec[] };
type PlaywrightJSONReport = { suites: PlaywrightSuite[] };

// `results.json` (local runs) and `results-<project>.json` (CI, one per Playwright project).
const REPORTS_DIR = path.join(__dirname, "..", "reports");
const ARTIFACTS_DIR = path.join(__dirname, "..", "..", ".artifacts");

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatMemoryKb(kb: number): string {
  return `${(kb / 1024).toFixed(1)} MB`;
}

function getStatusIcon(status: string): string {
  switch (status) {
    case "passed":
      return "✅";
    case "failed":
      return "❌";
    case "skipped":
      return "⏭️";
    case "timedOut":
      return "⏱️";
    default:
      return "❓";
  }
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function listReportPaths(): string[] {
  if (!fs.existsSync(REPORTS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(REPORTS_DIR)
    .filter((file) => /^results(-[\w-]+)?\.json$/.test(file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => path.join(REPORTS_DIR, file));
}

function printTestResults(): void {
  process.stdout.write("\n## Benchmark E2E Test Results\n");

  const reportPaths = listReportPaths();
  if (reportPaths.length === 0) {
    process.stdout.write(`\nNo Playwright JSON report found in: ${REPORTS_DIR}\n`);
    return;
  }
  for (const reportPath of reportPaths) {
    printTestReport(reportPath, { withHeading: reportPaths.length > 1 });
  }
}

function printTestReport(reportPath: string, { withHeading }: { withHeading: boolean }): void {
  const report = JSON.parse(fs.readFileSync(reportPath, "utf-8")) as PlaywrightJSONReport;

  if (withHeading) {
    process.stdout.write(`\n### ${path.basename(reportPath)}\n`);
  }
  process.stdout.write("| Status | Duration | Test |\n");
  process.stdout.write("|--------|----------|------|\n");

  for (const suite of report.suites) {
    for (const spec of suite.specs) {
      for (const test of spec.tests) {
        const lastResult = test.results.at(-1);
        if (!lastResult) {
          continue;
        }
        process.stdout.write(
          `| ${getStatusIcon(lastResult.status)} | ${formatDuration(lastResult.duration)} | ${spec.title} |\n`,
        );
      }
    }
  }
}

function printScenarioMetrics(): void {
  process.stdout.write("\n## Benchmark Scenario Metrics\n");

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    process.stdout.write(`\nArtifacts directory not found: ${ARTIFACTS_DIR}\n`);
    return;
  }

  // Legacy artifacts only: skip v1 results and overhead reports.
  const artifactFiles = fs
    .readdirSync(ARTIFACTS_DIR)
    .filter(
      (file) =>
        file.endsWith(".json") &&
        !file.endsWith(RESULT_V1_SUFFIX) &&
        !file.startsWith(OVERHEAD_PREFIX),
    );
  if (artifactFiles.length === 0) {
    process.stdout.write("\nNo benchmark artifacts found.\n");
    return;
  }

  const artifacts = artifactFiles
    .map((file) => {
      const contents = fs.readFileSync(path.join(ARTIFACTS_DIR, file), "utf-8");
      const artifact = JSON.parse(contents) as BenchmarkArtifact;
      // Web artifacts are named `<scenarioId>-web-<ts>.json`; Electron keeps `<scenarioId>-<ts>.json`.
      const isWeb = file.startsWith(`${artifact.scenarioId}-web-`);
      return { artifact, label: isWeb ? `${artifact.scenarioId} (web)` : artifact.scenarioId };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  process.stdout.write(
    "| Scenario | Pipeline | Avg Memory | Peak Memory | Avg Frame Time | Frame Samples |\n",
  );
  process.stdout.write(
    "|----------|----------|------------|-------------|-----------------|----------------|\n",
  );

  for (const { artifact, label } of artifacts) {
    const memoryTotalsKb = artifact.memorySamples.map((sample) =>
      sample.metrics.reduce((sum, metric) => sum + metric.memory.workingSetSize, 0),
    );
    const avgMemoryKb = average(memoryTotalsKb);
    const peakMemoryKb = memoryTotalsKb.length > 0 ? Math.max(...memoryTotalsKb) : 0;

    const frameTimes = artifact.frameTimeSamples.map((sample) => sample.value);
    const avgFrameTime = frameTimes.length > 0 ? `${average(frameTimes).toFixed(2)}ms` : "n/a";

    process.stdout.write(
      `| ${label} | ${artifact.pipeline} | ${formatMemoryKb(avgMemoryKb)} | ${formatMemoryKb(peakMemoryKb)} | ${avgFrameTime} | ${frameTimes.length} |\n`,
    );
  }
}

function readArtifactJson<T>(predicate: (file: string) => boolean): T[] {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    return [];
  }
  return fs
    .readdirSync(ARTIFACTS_DIR)
    .filter(predicate)
    .map((file) => JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, file), "utf-8")) as T);
}

/**
 * Scenario results as stored (overhead A/B runs dropped: they are summarized by their
 * `overhead-*.json` reports); older ones without `summary.kpis` get them backfilled (`withRunKpis`).
 */
function readResultsV1(): PersistedResultV1[] {
  return scenarioRunsOnly(
    readArtifactJson<StoredResultV1>((file) => file.endsWith(RESULT_V1_SUFFIX)),
  ).map(withRunKpis);
}

/** Overhead reports of schema 1, 2 or 3, normalized to schema 3 (unreadable ones are skipped). */
function readOverheadReports(): OverheadReport[] {
  return readArtifactJson<unknown>(
    (file) => file.startsWith(OVERHEAD_PREFIX) && file.endsWith(".json"),
  ).flatMap((json) => {
    const report = normalizeOverheadReport(json);
    return report != undefined ? [report] : [];
  });
}

function printScorecard(): void {
  process.stdout.write("\n## KPI Scorecard (per platform, latest telemetry-on run per scenario)\n");
  process.stdout.write(buildScorecardTable(readResultsV1(), readOverheadReports()));
  process.stdout.write("\n### Exercises\n");
  process.stdout.write(buildExercisesLines(readResultsV1()));
}

function printTelemetryResults(): void {
  process.stdout.write("\n## Benchmark Telemetry Results (benchmark-result.v1)\n");
  process.stdout.write(buildResultsTable(readResultsV1()));
}

function printPanelsAndPipeline(): void {
  process.stdout.write("\n## Panels and Pipeline (benchmark-result.v1)\n");
  process.stdout.write(buildPanelsSection(readResultsV1()));
}

function printOverheadReports(): void {
  process.stdout.write("\n## Telemetry Overhead (A/B: telemetry off vs on)\n");
  process.stdout.write(buildOverheadTable(readOverheadReports()));
}

function main(): void {
  process.stdout.write("# Benchmark E2E Summary\n");
  printScorecard();
  printTestResults();
  printScenarioMetrics();
  printTelemetryResults();
  printPanelsAndPipeline();
  printOverheadReports();
}

main();
