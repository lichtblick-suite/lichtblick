// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { ElectronApplication } from "@playwright/test";

import type {
  BenchmarkPlatform,
  BenchmarkTarget,
  DisposableBenchmarkTarget,
} from "../runner/types";

export type BenchmarkWorkerFixtures = {
  /** Set per Playwright project (`playwright.config.ts`). */
  platform: BenchmarkPlatform;
};

export type BenchmarkTestFixtures = {
  /**
   * Launches a fresh app instance (Electron app). Instances not disposed by the
   * test are disposed after it. Dispose an instance before launching the next one when measuring:
   * a second Electron window can occlude the first, which then gets background-throttled.
   */
  launchTarget: () => Promise<DisposableBenchmarkTarget>;
  /** One app instance for the test (lazily created via `launchTarget`). */
  target: BenchmarkTarget;
};

export type ElectronBenchmarkTarget = DisposableBenchmarkTarget & {
  readonly electronApp: ElectronApplication;
};
