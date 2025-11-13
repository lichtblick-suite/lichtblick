#!/usr/bin/env ts-node
// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as fs from "fs";
import * as path from "path";

type TestResult = {
  title: string;
  status: "passed" | "failed" | "skipped" | "timedOut";
  duration: number;
  retries: number;
};

type PlaywrightJSONReport = {
  suites: Array<{
    title: string;
    file: string;
    specs: Array<{
      title: string;
      tests: Array<{
        results: Array<{
          status: string;
          duration: number;
          retry: number;
        }>;
      }>;
    }>;
  }>;
};

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
}

function getStatusEmoji(status: string): string {
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
    console.log(`⚠️  Report not found: ${reportPath}`);
    return;
  }

  const report: PlaywrightJSONReport = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
  const tests: TestResult[] = [];

  for (const suite of report.suites) {
    for (const spec of suite.specs) {
      const testTitle = `${suite.title} › ${spec.title}`;

      for (const test of spec.tests) {
        // Get the last result (final outcome after retries)
        const lastResult = test.results[test.results.length - 1];
        if (lastResult) {
          tests.push({
            title: testTitle,
            status: lastResult.status as TestResult["status"],
            duration: lastResult.duration,
            retries: test.results.length - 1,
          });
        }
      }
    }
  }

  // Sort by duration (slowest first)
  tests.sort((a, b) => b.duration - a.duration);

  // Calculate statistics
  const totalTests = tests.length;
  const passed = tests.filter((t) => t.status === "passed").length;
  const failed = tests.filter((t) => t.status === "failed").length;
  const skipped = tests.filter((t) => t.status === "skipped").length;
  const timedOut = tests.filter((t) => t.status === "timedOut").length;
  const totalDuration = tests.reduce((sum, t) => sum + t.duration, 0);
  const avgDuration = totalDuration / totalTests;

  // Generate markdown table
  console.log(`\n## 📊 ${reportName} Summary\n`);
  console.log(
    `**Total Tests:** ${totalTests} | **Passed:** ${passed} ✅ | **Failed:** ${failed} ❌ | **Skipped:** ${skipped} ⏭️ | **Timed Out:** ${timedOut} ⏱️`,
  );
  console.log(
    `**Total Duration:** ${formatDuration(totalDuration)} | **Average:** ${formatDuration(avgDuration)}\n`,
  );

  // Show top 10 slowest tests
  console.log(`### 🐌 Top 10 Slowest Tests\n`);
  console.log(`| Status | Duration | Test | Retries |`);
  console.log(`|--------|----------|------|---------|`);

  tests.slice(0, 10).forEach((test) => {
    const statusEmoji = getStatusEmoji(test.status);
    const retriesText = test.retries > 0 ? `🔄 ${test.retries}` : "-";
    console.log(
      `| ${statusEmoji} | ${formatDuration(test.duration)} | ${test.title} | ${retriesText} |`,
    );
  });

  // Show all failed tests if any
  if (failed > 0) {
    console.log(`\n### ❌ Failed Tests\n`);
    console.log(`| Duration | Test | Retries |`);
    console.log(`|----------|------|---------|`);

    tests
      .filter((t) => t.status === "failed")
      .forEach((test) => {
        const retriesText = test.retries > 0 ? `🔄 ${test.retries}` : "-";
        console.log(`| ${formatDuration(test.duration)} | ${test.title} | ${retriesText} |`);
      });
  }

  console.log("");
}

function main(): void {
  const reportsDir = path.join(__dirname, "reports");

  console.log("# 🧪 E2E Test Results Summary\n");

  // Desktop tests
  const desktopReportPath = path.join(reportsDir, "desktop", "results.json");
  generateSummary(desktopReportPath, "Desktop E2E Tests");

  // Web tests
  const webReportPath = path.join(reportsDir, "web", "results.json");
  generateSummary(webReportPath, "Web E2E Tests");
}

main();
