// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/** Metric names produced by the renderer collectors (all scope "renderer"). */
export const RENDERER_METRICS = {
  /** gauge, bytes: Chromium `performance.memory.usedJSHeapSize` (this realm's JS heap only). */
  jsHeapUsedBytes: "renderer.jsHeap.usedBytes",
  /** gauge, bytes: Chromium `performance.memory.totalJSHeapSize`. */
  jsHeapTotalBytes: "renderer.jsHeap.totalBytes",
  /** gauge, bytes: Chromium `performance.memory.jsHeapSizeLimit`. */
  jsHeapLimitBytes: "renderer.jsHeap.limitBytes",
  /** counter, count: number of long tasks (> 50 ms main-thread tasks). */
  longTasksCount: "renderer.longTasks.count",
  /** counter, ms: summed duration of long tasks. */
  longTasksDurationMs: "renderer.longTasks.durationMs",
  /** gauge, fps: animation frames per second over the last collection window. */
  fps: "renderer.fps",
  /**
   * counter, count: animation frames whose delta to the previous frame exceeded the late-frame
   * threshold (`LATE_FRAME_THRESHOLD_MS` unless overridden, see `parseLateFrameThresholdMs`).
   */
  lateFrames: "renderer.lateFrames",
  /** counter, count: animation frames observed. */
  frames: "renderer.frames",
  /** gauge, bytes: `performance.measureUserAgentSpecificMemory()` total (cross-origin isolated only). */
  uaSpecificMemoryBytes: "renderer.uaSpecificMemory.bytes",
} as const;

/** Cadence of the renderer collector tick (heap, fps/late frames, periodic UA memory check). */
export const COLLECTOR_TICK_INTERVAL_MS = 1000;

/** Nominal 60 Hz frame budget. */
export const FRAME_BUDGET_MS = 1000 / 60;

/** A frame is "late" when its delta to the previous animation frame exceeds this many budgets. */
export const LATE_FRAME_BUDGET_MULTIPLIER = 1.5;

/**
 * Default late-frame threshold: 1.5 nominal 60 Hz frame budgets (25 ms). The runner overrides it
 * from the measured display refresh rate (see `telemetry.lateFrameThresholdMs`).
 */
export const LATE_FRAME_THRESHOLD_MS = LATE_FRAME_BUDGET_MULTIPLIER * FRAME_BUDGET_MS;

/** Minimum spacing between periodic `measureUserAgentSpecificMemory` calls. */
export const UA_MEMORY_MIN_INTERVAL_MS = 10_000;

/**
 * `DOMException.name` with which `measureUserAgentSpecificMemory()` rejects when the browser does not
 * provide it although the method exists and the page is cross-origin isolated (e.g. Playwright's
 * `chromium-headless-shell`: "performance.measureUserAgentSpecificMemory is not available"). The
 * collector then treats the API as unsupported and stops calling it.
 */
export const UA_MEMORY_UNAVAILABLE_ERROR_NAME = "SecurityError";

/** `PerformanceObserver` entry type observed by the `LongTaskCollector`. */
export const LONG_TASK_ENTRY_TYPE = "longtask";
