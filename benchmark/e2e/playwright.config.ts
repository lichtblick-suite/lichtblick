// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { defineConfig } from "@playwright/test";

import type { BenchmarkWorkerFixtures } from "./fixtures/types";

export default defineConfig<object, Pick<BenchmarkWorkerFixtures, "platform">>({
  reporter: process.env.CI
    ? [["blob"]] // Use blob reporter in CI for sharding support
    : [
        [
          "html",
          {
            outputFolder: "./reports",
            open: "never",
            title: "Benchmark E2E Tests",
          },
        ],
        ["json", { outputFile: "./reports/results.json" }],
        ["list"],
      ],
  testDir: "./",
  // Only the Playwright benchmark specs: `*.test.ts` files here are Jest unit tests.
  testMatch: "**/*.benchmark.spec.ts",
  name: "benchmark",
  // Generous timeout: launching the app, generating/serving the MCAP fixtures, playing the
  // scenario's `durationMs`, sampling host/page telemetry and capturing the data source close all
  // happen within a single test.
  timeout: 120 * 1000,
  retries: 0,
  workers: 1,
  use: {
    headless: true,
    ignoreHTTPSErrors: true,
    trace: "retain-on-first-failure",
    video: "retain-on-failure",
    // Failure screenshots of every page Playwright tracks: the web project's Chromium pages and the
    // Electron window (verified with Playwright 1.60: a failing Electron test gets a
    // `test-failed-1.png`). Complements the checkpoint screenshots of `runScenario`
    // (`runner/screenshots.ts`, attached as soon as they are taken).
    screenshot: "only-on-failure",
  },
  projects: [
    // Standalone benchmark Electron shell (`yarn benchmark:desktop:build:prod`).
    { name: "electron", use: { platform: "electron" } },
    // Static web build (`yarn benchmark:build:prod`) in headless Chromium.
    { name: "web", use: { platform: "web" } },
  ],
});
