// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test as base, _electron as electron, ElectronApplication, Page } from "@playwright/test";
import electronPath from "electron";
import fs from "fs";
import { mkdtemp, readFile, mkdir, writeFile } from "fs/promises";
import JSZip from "jszip";
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
    console.log("preInstalled", preInstalledExtensions)

    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "e2e-test-"));
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "home-e2e-test-"));


    for (const filename of preInstalledExtensions ?? []) {
      preInstallExtensionInUserFolder(homeDir, filename);
    }
    console.log("---------> passed on preload")

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
  console.log("-----------> entering preload")
  const source = path.join(process.cwd(), "e2e", "fixtures", "assets", filename);
  console.log("------------> source", source)

  if (!fs.existsSync(source)) {
    throw new Error(`Extension asset not found: ${source}`);
  }

  const extensionsDir = path.join(homeDir, ".lichtblick-suite", "extensions");

  console.log("------------> extensions Dir created", extensionsDir)

  fs.mkdirSync(extensionsDir, { recursive: true });

  fs.copyFileSync(source, path.join(extensionsDir, filename));

  console.log("-------------> Read Dir", fs.readdirSync(extensionsDir))
}

export { expect } from "@playwright/test";
