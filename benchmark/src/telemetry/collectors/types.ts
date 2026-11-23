// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { SelfCostMeter } from "./SelfCostMeter";

/**
 * Chromium-only, non-standard `performance.memory`. Describes the JS heap of the current realm
 * only; it is NOT the total memory of the renderer process.
 */
export type ChromiumPerformanceMemory = {
  readonly usedJSHeapSize: number;
  readonly totalJSHeapSize: number;
  readonly jsHeapSizeLimit: number;
};

/** Result of `performance.measureUserAgentSpecificMemory()` (only `bytes` is used). */
export type UserAgentSpecificMemoryResult = {
  readonly bytes: number;
};

/** The subset of `Performance` the collectors read, with the non-standard members typed locally. */
export type CollectorPerformance = {
  readonly memory?: ChromiumPerformanceMemory;
  measureUserAgentSpecificMemory?: () => Promise<UserAgentSpecificMemoryResult>;
};

export type LongTaskEntry = {
  readonly duration: number;
};

export type LongTaskEntryList = {
  getEntries(): readonly LongTaskEntry[];
};

export type LongTaskObserver = {
  observe(options: { type: string; buffered?: boolean }): void;
  disconnect(): void;
};

/** Structural subset of the `PerformanceObserver` constructor used for long tasks. */
export type LongTaskObserverConstructor = {
  new (callback: (list: LongTaskEntryList) => void): LongTaskObserver;
  readonly supportedEntryTypes?: readonly string[];
};

/** Environment the renderer collectors run against; injectable for tests. */
export type RendererCollectorsEnv = {
  /** Monotonic ms clock used for fps windows and UA-memory spacing (default `performance.now`). */
  now: () => number;
  setInterval: (handler: () => void, intervalMs: number) => unknown;
  clearInterval: (handle: unknown) => void;
  /** Undefined when the realm has no animation frames (e.g. a worker or a test env). */
  requestAnimationFrame?: (callback: (timestamp: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
  performance?: CollectorPerformance;
  PerformanceObserver?: LongTaskObserverConstructor;
  crossOriginIsolated?: boolean;
};

/** Tunables of the renderer collectors. */
export type RendererCollectorsOptions = {
  /** Late-frame threshold of the `FrameCollector`; defaults to `LATE_FRAME_THRESHOLD_MS`. */
  lateFrameThresholdMs?: number;
  /**
   * Self-cost accumulator shared with the installer (sink publish / drain timing); its counters
   * are published on the collector tick. Defaults to a private meter on `env.now`.
   */
  selfCost?: SelfCostMeter;
};

/** The parts of `RendererCollectorsEnv` the `FrameCollector` reads. */
export type FrameCollectorEnv = Pick<
  RendererCollectorsEnv,
  "now" | "requestAnimationFrame" | "cancelAnimationFrame"
>;

/** The parts of `RendererCollectorsEnv` the `UaSpecificMemoryCollector` reads. */
export type UaSpecificMemoryCollectorEnv = Pick<
  RendererCollectorsEnv,
  "now" | "performance" | "crossOriginIsolated"
>;
