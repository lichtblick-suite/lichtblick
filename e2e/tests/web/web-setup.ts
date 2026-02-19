// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable filenames/match-exported */

import { chromium, FullConfig } from "@playwright/test";

import { STORAGE_STATE } from "./playwright.config";

async function webSetup(config: FullConfig): Promise<void> {
  console.debug("Running web setup...");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const baseURL: boolean = config.projects[0].use.baseURL;
  if (!baseURL) {
    throw new Error("Web baseURL not defined");
  }

  await page.goto(baseURL);
  await page.waitForTimeout(1000);

  await page.context().storageState({
    path: STORAGE_STATE,
  });

  await browser.close();
}

export default webSetup;
