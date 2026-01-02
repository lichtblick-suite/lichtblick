// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as fs from "fs";
import * as path from "path";

import { PlaywrightJSONReport, ReportTestResult } from "./types";

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
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

function generateSummary(reportPath: string, reportName: string): void {
  if (!fs.existsSync(reportPath)) {
    console.error(`Report not found: ${reportPath}`);
    return;
  }

  const fileContent = fs.readFileSync(reportPath, "utf-8");
  if (!fileContent || fileContent.trim().length === 0) {
    console.error(`Report is empty: ${reportPath}`);
    return;
  }

  let report: PlaywrightJSONReport;

  try {
    report = JSON.parse(fileContent);
  } catch (error) {
    console.error(`Failed to parse report: ${reportPath}`);
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  if (report.suites.length === 0) {
    console.error(`No test suites found in report: ${reportPath}`);
    return;
  }

  const tests: ReportTestResult[] = [];

  for (const suite of report.suites) {
    for (const spec of suite.specs) {
      const testTitle = `${suite.title} › ${spec.title}`;

      for (const test of spec.tests) {
        // Get the last result (final outcome after retries)
        const lastResult = test.results[test.results.length - 1];
        if (lastResult) {
          tests.push({
            title: testTitle,
            status: lastResult.status as ReportTestResult["status"],
            duration: lastResult.duration,
            retries: test.results.length - 1,
          });
        }
      }
    }
  }

  // Sort tests by duration descending (slowest first)
  tests.sort((a, b) => b.duration - a.duration);

  if (tests.length === 0) {
    process.stdout.write(`\n## ${reportName} Summary\n`);
    process.stdout.write(`No tests found in report.\n`);
    return;
  }

  // Metrics
  const totalTests = tests.length;
  const passed = tests.filter((t) => t.status === "passed").length;
  const failed = tests.filter((t) => t.status === "failed").length;
  const skipped = tests.filter((t) => t.status === "skipped").length;
  const timedOut = tests.filter((t) => t.status === "timedOut").length;
  const totalDuration = tests.reduce((sum, t) => sum + t.duration, 0);
  const avgDuration = totalDuration / totalTests;

  /**
   * Output Summary
   */
  process.stdout.write(`\n## ${reportName} Summary\n`);
  process.stdout.write(`| Metric | Value |\n`);
  process.stdout.write(`|--------|-------|\n`);
  process.stdout.write(`| Total Tests | ${totalTests} |\n`);
  process.stdout.write(`| Passed ✅ | ${passed} |\n`);
  process.stdout.write(`| Failed ❌ | ${failed} |\n`);
  process.stdout.write(`| Skipped | ${skipped} |\n`);
  process.stdout.write(`| Timed Out | ${timedOut} |\n`);
  process.stdout.write(`| Total Duration | ${formatDuration(totalDuration)} |\n`);
  process.stdout.write(`| Average Duration | ${formatDuration(avgDuration)} |\n`);
  process.stdout.write(`\n`);

  /**
   * Slowest Tests
   */
  process.stdout.write(`### Top 10 Slowest Tests\n`);
  process.stdout.write(`| Status | Duration | Test | Retries |\n`);
  process.stdout.write(`|--------|----------|------|---------|\n`);

  tests.slice(0, 10).forEach((test) => {
    const statusEmoji = getStatusIcon(test.status);
    const retriesText = test.retries > 0 ? `🔄 ${test.retries}` : "-";
    process.stdout.write(
      `| ${statusEmoji} | ${formatDuration(test.duration)} | ${test.title} | ${retriesText} |\n`,
    );
  });

  /**
   * Failed Tests
   */
  if (failed > 0) {
    process.stdout.write(`\n### ❌ Failed Tests\n`);
    process.stdout.write(`| Duration | Test | Retries |\n`);
    process.stdout.write(`|----------|------|---------|\n`);

    tests
      .filter((t) => t.status === "failed")
      .forEach((test) => {
        const retriesText = test.retries > 0 ? `🔄 ${test.retries}` : "-";
        process.stdout.write(
          `| ${formatDuration(test.duration)} | ${test.title} | ${retriesText} |\n`,
        );
      });
  }

  process.stdout.write("\n");
}

function main(): void {
  const reportsDir = path.join(__dirname, "..", "reports");
  process.stdout.write(`Generating E2E test summary from reports in: ${reportsDir}\n`);

  process.stdout.write("# E2E Test Results Summary\n");

  // Desktop tests
  const desktopReportPath = path.join(reportsDir, "desktop", "results.json");
  generateSummary(desktopReportPath, "Desktop E2E Tests");

  // Web tests
  const webReportPath = path.join(reportsDir, "web", "results.json");
  generateSummary(webReportPath, "Web E2E Tests");
}

main();
