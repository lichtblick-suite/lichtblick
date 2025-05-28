// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test as base, _electron as electron, ElectronApplication, Page } from "@playwright/test";
import electronPath from "electron";
import fs from "fs";
import path from "path";

import clearStorage from "./clear-storage";

export type ElectronFixtures = {
  electronApp: ElectronApplication;
  mainWindow: Page;
};

const WEBPACK_PATH = path.resolve(__dirname, "../../desktop/.webpack");

export const test = base.extend<ElectronFixtures>({
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, use) => {
    await clearStorage();
    checkBuild(WEBPACK_PATH);

    const app = await electron.launch({
      args: [WEBPACK_PATH],
      executablePath: electronPath as unknown as string,
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
  if (!fs.existsSync(webpackPath)) {
    throw new Error(`Webpack path does not exist: ${webpackPath}`);
  }
  const files = fs.readdirSync(webpackPath);
  if (files.length === 0) {
    throw new Error(`Webpack path is empty: ${webpackPath}`);
  }
}

export { expect } from "@playwright/test";
