// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test as base } from "@playwright/test";

import { launchElectronTarget } from "./benchmark-electron";
import type { BenchmarkTestFixtures, BenchmarkWorkerFixtures } from "./types";
import type { DisposableBenchmarkTarget } from "../runner/types";

export const test = base.extend<BenchmarkTestFixtures, BenchmarkWorkerFixtures>({
  platform: ["electron", { option: true, scope: "worker" }],

  launchTarget: async ({ platform }, use) => {
    const launched: DisposableBenchmarkTarget[] = [];
    const launch = async (): Promise<DisposableBenchmarkTarget> => {
      if (platform !== "electron") {
        throw new Error(`Unsupported benchmark platform: ${platform}`);
      }
      const instance = await launchElectronTarget();
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
    // Targets own separate app instances: dispose them concurrently (each failure only warns).
    await Promise.all(
      launched.map(async (target) => {
        await target.dispose().catch((error: unknown) => {
          console.warn(`Failed to dispose ${target.platform} target`, error);
        });
      }),
    );
  },

  target: async ({ launchTarget }, use) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture `use`, not React hook
    await use(await launchTarget());
  },
});

export { expect } from "@playwright/test";
