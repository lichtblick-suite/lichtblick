// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Browser, ElectronApplication } from "@playwright/test";

import type { WebBrowserV1 } from "../result/schemaV1.types";
import type {
  BenchmarkPlatform,
  BenchmarkTarget,
  DisposableBenchmarkTarget,
} from "../runner/types";

/**
 * Options of `generateMcapFixtures`: deterministic MCAP fixtures for the `mcap-multi-ingest`
 * scenario (see `generateMcapFixtures.ts`).
 */
export type McapFixtureOptions = {
  /** Number of files. Default 4. */
  fileCount?: number;
  /** Time span of every file in seconds. Default 10. */
  durationSec?: number;
  /** Messages per second per file. Default 200. */
  rateHz?: number;
  /** Length of the `payload` string per message. Default 1024. */
  payloadBytes?: number;
  /** Topic name. Default `/benchmark/multi`. */
  topic?: string;
  /** Chunk size passed to `McapWriter`. Default 256 KiB. */
  chunkSize?: number;
};

/** Options of `launchTarget`. */
export type LaunchTargetOptions = {
  /** Web only (Electron ignores it): Chromium build. Default `chromium-headless-shell`. */
  webBrowser?: WebBrowserV1;
};

export type BenchmarkWorkerFixtures = {
  /** Set per Playwright project (`playwright.config.ts`). */
  platform: BenchmarkPlatform;
  /**
   * Worker-scoped localhost static server: `/fixtures/` serves the runtime-generated MCAP fixtures
   * (both platforms); on web, `/` serves the static benchmark build (`benchmark/.webpack`).
   */
  benchmarkServer: { origin: string; fixtureUrls: readonly string[] };
  /**
   * URLs of the longer overhead A/B MCAP fixtures (`runner/overheadFixtures.ts`), served under
   * `/fixtures/overhead/<seconds>s/`: `relaunch` sized for the configured steady window
   * (`BENCHMARK_OVERHEAD_POLLS`), `toggle` for the toggle blocks (empty with method `relaunch`).
   * Generated on first use per worker (cached on disk per duration).
   */
  overheadFixtureUrls: { relaunch: readonly string[]; toggle: readonly string[] };
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
  /** URLs of the scenario MCAP fixtures (`benchmarkServer.fixtureUrls`). */
  fixtureUrls: readonly string[];
};

export type ElectronBenchmarkTarget = DisposableBenchmarkTarget & {
  readonly electronApp: ElectronApplication;
};

export type WebBenchmarkTarget = DisposableBenchmarkTarget & {
  readonly browser: Browser;
};
