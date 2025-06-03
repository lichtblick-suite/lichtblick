// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { defineConfig } from "@playwright/test";

export const STORAGE_STATE = "e2e/tmp/desktop-session.json";

export default defineConfig({
  reporter: [
    ["html", { outputFolder: "../reports/desktop", open: "never", title: "Desktop E2E Tests" }],
  ],
  testDir: "./",
  name: "desktop",
  timeout: 30 * 1000,
  retries: 1,
  workers: 1,
  use: {
    headless: true,
    storageState: STORAGE_STATE,
    ignoreHTTPSErrors: true,
    trace: "retain-on-first-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
