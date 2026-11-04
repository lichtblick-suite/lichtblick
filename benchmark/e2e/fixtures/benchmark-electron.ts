// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { _electron as electron, Page } from "@playwright/test";
import electronPath from "electron";
import fs from "node:fs";

import { electronLaunchArgs } from "./electronLaunchArgs";
import type { ElectronBenchmarkTarget } from "./types";
import { DESKTOP_BUILD_DIR } from "../runner/constants";
import { collectElectronHostMetrics } from "../runner/electronHostCollector";
import { describeHost } from "../runner/runScenario";
import type { RunEnvironment } from "../runner/types";

// Standalone Electron shell for `benchmark/` (see `benchmark/webpack.desktop.config.ts`), distinct
// from the production app's `desktop/.webpack` used by `e2e/fixtures/electron.ts`. It has no
// user-data-dir/extension pre-install concerns since `Root.tsx` uses an in-memory-only
// `MemoryAppConfiguration` and no extension loaders.

/** Launches a fresh benchmark Electron app and wraps it as a `BenchmarkTarget`. */
export async function launchElectronTarget(): Promise<ElectronBenchmarkTarget> {
  checkBuild(DESKTOP_BUILD_DIR);

  const electronApp = await electron.launch({
    // Platform-conditional WebGL switches: SwiftShader on Linux CI, none on macOS (where it breaks
    // WebGL), see `electronLaunchArgs.ts`.
    args: electronLaunchArgs({ appDir: DESKTOP_BUILD_DIR }),
    executablePath: electronPath as unknown as string,
  });
  try {
    const page: Page = await electronApp.firstWindow();
    const baseUrl = page.url().split("?")[0]!;
    const versions = await electronApp.evaluate(() => ({
      electron: process.versions.electron,
      chrome: process.versions.chrome,
    }));
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const environment: RunEnvironment = {
      ...describeHost(),
      userAgent,
      electronVersion: versions.electron,
      chromiumVersion: versions.chrome,
    };
    return {
      platform: "electron",
      page,
      electronApp,
      scenarioUrl: (params) => `${baseUrl}?${params.toString()}`,
      collectHostMetrics: async (ts) => await collectElectronHostMetrics(page, ts),
      describe: () => ({ ...environment }),
      dispose: async () => {
        await electronApp.close();
      },
    };
  } catch (error) {
    await electronApp.close();
    throw error;
  }
}

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
