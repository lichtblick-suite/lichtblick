// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: process.env.CI
    ? [["blob"]] // Use blob reporter in CI for sharding support
    : [
        ["html", { outputFolder: "./reports", open: "never", title: "Benchmark E2E Tests" }],
        ["json", { outputFile: "./reports/results.json" }],
        ["list"],
      ],
  testDir: "./",
  name: "benchmark",
  // Generous timeout: launching Electron, fetching the remote MCAP fixture (up to 60s on a slow
  // connection), playing the scenario's `durationMs`, and sampling memory/frame-time all happen
  // within a single test.
  timeout: 120 * 1000,
  retries: 0,
  workers: 1,
  use: {
    headless: true,
    ignoreHTTPSErrors: true,
    trace: "retain-on-first-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
