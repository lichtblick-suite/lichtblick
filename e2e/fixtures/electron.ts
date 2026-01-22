// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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
  preInstalledExtensions?: string[];
};

const WEBPACK_PATH = path.resolve(__dirname, "../../desktop/.webpack");

export const test = base.extend<ElectronFixtures & { electronArgs: string[] }>({
  electronArgs: [],
  preInstalledExtensions: [],

  electronApp: async ({ electronArgs, preInstalledExtensions }, use) => {
    checkBuild(WEBPACK_PATH);

    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "e2e-test-"));
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "home-e2e-test-"));

    for (const filename of preInstalledExtensions ?? []) {
      preInstallExtensionInUserFolder(homeDir, filename);
    }

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

function preInstallExtensionInUserFolder(homeDir: string, filename: string): void {
  const source = path.join(process.cwd(), "e2e", "fixtures", "assets", filename);

  if (!fs.existsSync(source)) {
    throw new Error(`Extension asset not found: ${source}`);
  }

  const extensionsDir = path.join(homeDir, ".lichtblick-suite", "extensions");
  fs.mkdirSync(extensionsDir, { recursive: true });

  const stats = fs.statSync(source);
  if (stats.isDirectory()) {
    const destDir = path.join(extensionsDir, filename);
    fs.cpSync(source, destDir, { recursive: true });
  } else {
    fs.copyFileSync(source, path.join(extensionsDir, filename));
  }
}

export { expect } from "@playwright/test";
