// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test as base, _electron as electron, ElectronApplication, Page } from "@playwright/test";
import electronPath from "electron";
import fs from "fs";
import { mkdtemp } from "fs/promises";
import * as os from "os";
import path from "path";

export type ElectronFixtures = {
  electronApp: ElectronApplication;
  mainWindow: Page;
};

const WEBPACK_PATH = path.resolve(__dirname, "../../desktop/.webpack");

export const test = base.extend<ElectronFixtures & { electronArgs: string[] }>({
  electronArgs: [],
  electronApp: async ({ electronArgs }, use) => {
    checkBuild(WEBPACK_PATH);

    // Create a new user data directory for each test, which bypasses the `app.requestSingleInstanceLock()`
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "e2e-test-"));

    // Create a new home directory for each test, which creates a brand new .lcihtblick-suite directory for e2e testing
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "home-e2e-test-"));

    const app = await electron.launch({
      args: [
        WEBPACK_PATH,
        `--user-data-dir=${userDataDir}`,
        `--home-dir=${homeDir}`,
        ...electronArgs,
      ],
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
