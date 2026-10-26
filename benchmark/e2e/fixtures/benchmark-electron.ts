// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test as base, _electron as electron, ElectronApplication, Page } from "@playwright/test";
import electronPath from "electron";
import fs from "node:fs";
import path from "node:path";

export type BenchmarkElectronFixtures = {
  electronApp: ElectronApplication;
  mainWindow: Page;
};

// Standalone Electron shell for `benchmark/` (see `benchmark/webpack.desktop.config.ts`), distinct
// from the production app's `desktop/.webpack` used by `e2e/fixtures/electron.ts`. It has no
// user-data-dir/extension pre-install concerns since `Root.tsx` uses an in-memory-only
// `MemoryAppConfiguration` and no extension loaders.
const WEBPACK_PATH = path.resolve(__dirname, "../../.webpack-desktop");

export const test = base.extend<BenchmarkElectronFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires an object destructuring pattern here
  electronApp: async ({}, use) => {
    checkBuild(WEBPACK_PATH);

    const app = await electron.launch({
      args: [
        WEBPACK_PATH,
        // Force ANGLE's SwiftShader backend so GPU-heavy scenarios (pointcloud/transform 3D
        // panels) render reliably under headless CI, mirroring `e2e/fixtures/electron.ts`.
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
      executablePath: electronPath as unknown as string,
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture `use`, not React hook
    await use(app);
    await app.close();
  },

  mainWindow: async ({ electronApp }, use) => {
    const mainAppWindow = await electronApp.firstWindow();
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture `use`, not React hook
    await use(mainAppWindow);
  },
});

function checkBuild(webpackPath: string): void {
  if (!fs.existsSync(webpackPath)) {
    throw new Error(
      `Webpack path does not exist: ${webpackPath}. Run \`yarn benchmark:desktop:build:dev\` (or :prod) first.`,
    );
  }
  const files = fs.readdirSync(webpackPath);
  if (files.length === 0) {
    throw new Error(
      `Webpack path is empty: ${webpackPath}. Run \`yarn benchmark:desktop:build:dev\` (or :prod) first.`,
    );
  }
}

export { expect } from "@playwright/test";
