// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { defineConfig, devices } from "@playwright/test";

const URL = "http://localhost:8080";
export const STORAGE_STATE = "e2e/tmp/web-session.json";

export default defineConfig({
  globalSetup: require.resolve("./web-setup.ts"),
  globalTeardown: require.resolve("./web-teardown.ts"),
  reporter: [["html", { outputFolder: "./reports", open: "never", title: "Web E2E Tests" }]],
  timeout: 30 * 1000,
  testDir: "./",
  webServer: {
    command: "yarn web:serve",
    url: URL,
    timeout: 3 * 60 * 1000,
  },
  projects: [
    // {
    //   name: "setup",
    //   testMatch: /web\.setup\.ts/,
    //   teardown: "cleanup",
    // },
    // {
    //   name: "cleanup",
    //   testMatch: /web\.teardown\.ts/,
    // },
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
