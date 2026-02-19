// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { defineConfig, devices } from "@playwright/test";

const URL = "http://localhost:8080";
export const STORAGE_STATE = "e2e/tmp/web-session.json";

export default defineConfig({
  globalSetup: require.resolve("./web-setup.ts"),
  globalTeardown: require.resolve("./web-teardown.ts"),
  reporter: process.env.CI
    ? [["json", { outputFile: "../../reports/web/results.json" }], ["list"]]
    : [
        ["html", { outputFolder: "../reports/web", open: "never", title: "Web E2E Tests" }],
        ["json", { outputFile: "../reports/web/results.json" }],
        ["list"],
      ],
  timeout: 30 * 1000,
  testDir: "./",
  webServer: {
    command: "yarn web:serve",
    url: URL,
    timeout: 3 * 60 * 1000,
  },
  projects: [
    {
      name: "web-chromium",
      use: {
        baseURL: URL,
        storageState: STORAGE_STATE,
        headless: true,
        trace: "on-first-retry",
        video: "retain-on-failure",
        screenshot: "only-on-failure",
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
