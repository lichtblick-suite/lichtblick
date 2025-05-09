// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test as base, _electron as electron, ElectronApplication, Page } from "@playwright/test";
import electronPath from "electron";
import fs from "fs";
import path from "path";

export type ElectronFixtures = {
  electronApp: ElectronApplication;
  mainWindow: Page;
};

export const test = base.extend<ElectronFixtures>({
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, use) => {
    const webpackPath = "desktop/.webpack";
    checkBuild(webpackPath);

    const env: Record<string, string> = {};
    if (process.env.CI) {
      env.E2E_TEST = "true";
    }

    const app = await electron.launch({
      args: [webpackPath],
      executablePath: electronPath as unknown as string,
      env,
    });
    await use(app);
    await app.close();
  },

  mainWindow: async ({ electronApp }, use) => {
    const mainAppWindow = await electronApp.firstWindow();
    await use(mainAppWindow);
  },
});

function checkBuild(webpackPath: string): void {
  const resolvedWebpackPath = path.join(__dirname, "../../", webpackPath);

  if (!fs.existsSync(resolvedWebpackPath)) {
    throw new Error(`Webpack path does not exist: ${resolvedWebpackPath}`);
  }
  const files = fs.readdirSync(resolvedWebpackPath);
  if (files.length === 0) {
    throw new Error(`Webpack path is empty: ${resolvedWebpackPath}`);
  }
}

export { expect } from "@playwright/test";
