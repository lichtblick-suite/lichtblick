// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Browser, ElectronApplication } from "@playwright/test";

import type { WebBrowserV1 } from "../result/schemaV1.types";
import type {
  BenchmarkPlatform,
  BenchmarkTarget,
  DisposableBenchmarkTarget,
} from "../runner/types";

/** Options of `launchTarget`. */
export type LaunchTargetOptions = {
  /** Web only (Electron ignores it): Chromium build. Default `chromium-headless-shell`. */
  webBrowser?: WebBrowserV1;
};

export type BenchmarkWorkerFixtures = {
  /** Set per Playwright project (`playwright.config.ts`). */
  platform: BenchmarkPlatform;
  /**
   * Worker-scoped localhost static server: on web, `/` serves the static benchmark build
   * (`benchmark/.webpack`).
   */
  benchmarkServer: { origin: string };
};

export type BenchmarkTestFixtures = {
  /**
   * Launches a fresh app instance (Electron app / Chromium browser). Instances not disposed by the
   * test are disposed after it. Dispose an instance before launching the next one when measuring:
   * a second Electron window can occlude the first, which then gets background-throttled.
   */
  launchTarget: (options?: LaunchTargetOptions) => Promise<DisposableBenchmarkTarget>;
  /** One app instance for the test (lazily created via `launchTarget`). */
  target: BenchmarkTarget;
};

export type ElectronBenchmarkTarget = DisposableBenchmarkTarget & {
  readonly electronApp: ElectronApplication;
};

export type WebBenchmarkTarget = DisposableBenchmarkTarget & {
  readonly browser: Browser;
};
