// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import fs from "node:fs";
import path from "node:path";

import type { BenchmarkArtifact } from "../types";

// Copied rather than imported from `e2e/ci-helpers/types.ts`: kept local since this report only
// needs pass/fail/duration, and importing that module would re-run its own `main()` side effect.
type PlaywrightTestResult = { status: string; duration: number };
type PlaywrightTest = { results: PlaywrightTestResult[] };
type PlaywrightSpec = { title: string; tests: PlaywrightTest[] };
type PlaywrightSuite = { title: string; specs: PlaywrightSpec[] };
type PlaywrightJSONReport = { suites: PlaywrightSuite[] };

const REPORT_PATH = path.join(__dirname, "..", "reports", "results.json");
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

function printTestResults(): void {
  process.stdout.write("\n## Benchmark E2E Test Results\n");

  if (!fs.existsSync(REPORT_PATH)) {
    process.stdout.write(`\nReport not found: ${REPORT_PATH}\n`);
    return;
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf-8")) as PlaywrightJSONReport;

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
    process.stdout.write(`\nNo benchmark artifacts found at: ${ARTIFACTS_DIR}\n`);
    return;
  }

  const artifactFiles = fs.readdirSync(ARTIFACTS_DIR).filter((file) => file.endsWith(".json"));
  if (artifactFiles.length === 0) {
    process.stdout.write("\nNo benchmark artifacts found.\n");
    return;
  }

  const artifacts = artifactFiles
    .map((file) => {
      const contents = fs.readFileSync(path.join(ARTIFACTS_DIR, file), "utf-8");
      return JSON.parse(contents) as BenchmarkArtifact;
    })
    .sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));

  process.stdout.write(
    "| Scenario | Pipeline | Avg Memory | Peak Memory | Avg Frame Time | Frame Samples |\n",
  );
  process.stdout.write(
    "|----------|----------|------------|-------------|-----------------|----------------|\n",
  );

  for (const artifact of artifacts) {
    const memoryTotalsKb = artifact.memorySamples.map((sample) =>
      sample.metrics.reduce((sum, metric) => sum + metric.memory.workingSetSize, 0),
    );
    const avgMemoryKb = average(memoryTotalsKb);
    const peakMemoryKb = memoryTotalsKb.length > 0 ? Math.max(...memoryTotalsKb) : 0;

    const frameTimes = artifact.frameTimeSamples.map((sample) => sample.value);
    const avgFrameTime = frameTimes.length > 0 ? `${average(frameTimes).toFixed(2)}ms` : "n/a";

    process.stdout.write(
      `| ${artifact.scenarioId} | ${artifact.pipeline} | ${formatMemoryKb(avgMemoryKb)} | ${formatMemoryKb(peakMemoryKb)} | ${avgFrameTime} | ${frameTimes.length} |\n`,
    );
  }
}

function main(): void {
  process.stdout.write("# Benchmark E2E Summary\n");
  printTestResults();
  printScenarioMetrics();
}

main();
