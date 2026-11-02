// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { chromium, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { RUN_MARKER_SWITCH } from "./constants";
import type { WebBenchmarkTarget } from "./types";
import { WEB_BUILD_DIR } from "../runner/constants";
import { describeHost } from "../runner/runScenario";
import type { RunEnvironment } from "../runner/types";
import { WebHostCollector } from "../runner/webHostCollector";

/**
 * Launches a fresh headless Chromium for the static web build served at `origin` (see
 * `server/staticServer.ts`, which sends COOP/COEP so the page is cross-origin isolated) and wraps
 * it as a `BenchmarkTarget` with the CDP + `ps` host collector.
 */
export async function launchWebTarget(origin: string): Promise<WebBenchmarkTarget> {
  checkWebBuild(WEB_BUILD_DIR);
  const marker = `${RUN_MARKER_SWITCH}=${randomUUID()}`;
  const browser = await chromium.launch({
    headless: true,
    args: [
      // Unquantized `performance.memory` (renderer.jsHeap.* metrics).
      "--enable-precise-memory-info",
      // Same software GL backend as the Electron runs, for the 3D panel scenarios.
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      marker,
    ],
  });
  const collector = new WebHostCollector({ browser, marker });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page: Page = await context.newPage();
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const environment: RunEnvironment = {
      ...describeHost(),
      userAgent,
      chromiumVersion: browser.version(),
    };
    return {
      platform: "web",
      page,
      browser,
      scenarioUrl: (params) => `${origin}/?${params.toString()}`,
      collectHostMetrics: async (ts) => await collector.collect(ts),
      describe: () => ({ ...environment }),
      dispose: async () => {
        await collector.dispose();
        await browser.close();
      },
    };
  } catch (error) {
    await collector.dispose();
    await browser.close();
    throw error;
  }
}

function checkWebBuild(dir: string): void {
  if (!fs.existsSync(path.join(dir, "index.html"))) {
    throw new Error(`Web build not found in ${dir}. Run \`yarn benchmark:build:prod\` first.`);
  }
}
