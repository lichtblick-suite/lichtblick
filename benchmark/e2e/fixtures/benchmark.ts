// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test as base } from "@playwright/test";

import { launchElectronTarget } from "./benchmark-electron";
import { launchWebTarget } from "./benchmark-web";
import { generateMcapFixtures } from "./generateMcapFixtures";
import type { BenchmarkTestFixtures, BenchmarkWorkerFixtures } from "./types";
import { FIXTURES_DIR, WEB_BUILD_DIR } from "../runner/constants";
import type { DisposableBenchmarkTarget } from "../runner/types";
import { startStaticServer } from "../server/staticServer";

export const test = base.extend<BenchmarkTestFixtures, BenchmarkWorkerFixtures>({
  platform: ["electron", { option: true, scope: "worker" }],

  benchmarkServer: [
    async ({ platform }, use) => {
      const files = await generateMcapFixtures(FIXTURES_DIR);
      const routes: Record<string, string> = { "/fixtures/": FIXTURES_DIR };
      if (platform === "web") {
        routes["/"] = WEB_BUILD_DIR;
      }
      const server = await startStaticServer({ routes });
      const fixtureUrls = files.map((file) => `${server.origin}/fixtures/${file}`);
      await use({ origin: server.origin, fixtureUrls });
      await server.close();
    },
    { scope: "worker" },
  ],

  fixtureUrls: async ({ benchmarkServer }, use) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture `use`, not React hook
    await use(benchmarkServer.fixtureUrls);
  },

  launchTarget: async ({ platform, benchmarkServer }, use) => {
    const launched: DisposableBenchmarkTarget[] = [];
    const launch = async (): Promise<DisposableBenchmarkTarget> => {
      const instance =
        platform === "web"
          ? await launchWebTarget(benchmarkServer.origin)
          : await launchElectronTarget();
      let disposed: Promise<void> | undefined;
      const target: DisposableBenchmarkTarget = {
        ...instance,
        dispose: async () => {
          disposed ??= instance.dispose();
          await disposed;
        },
      };
      launched.push(target);
      return target;
    };
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture `use`, not React hook
    await use(launch);
    for (const target of launched) {
      await target.dispose().catch((error: unknown) => {
        console.warn(`Failed to dispose ${target.platform} target`, error);
      });
    }
  },

  target: async ({ launchTarget }, use) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture `use`, not React hook
    await use(await launchTarget());
  },
});

export { expect } from "@playwright/test";
