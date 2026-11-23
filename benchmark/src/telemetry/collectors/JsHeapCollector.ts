// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { ITelemetry } from "@lichtblick/suite-base/util/telemetry";

import { RENDERER_METRICS } from "./constants";
import { CollectorPerformance } from "./types";

/**
 * Samples Chromium's non-standard `performance.memory` into gauges. These values cover the JS
 * heap of the renderer main realm only; they never represent total process memory (use the
 * Electron process metrics for that). No-op where `performance.memory` is absent.
 */
export class JsHeapCollector {
  readonly #telemetry: ITelemetry;
  readonly #performance: CollectorPerformance | undefined;

  public constructor(telemetry: ITelemetry, performance: CollectorPerformance | undefined) {
    this.#telemetry = telemetry;
    this.#performance = performance;
  }

  public sample(): void {
    const memory = this.#performance?.memory;
    if (memory == undefined) {
      return;
    }
    const telemetry = this.#telemetry;
    telemetry.gauge(RENDERER_METRICS.jsHeapUsedBytes, memory.usedJSHeapSize, "bytes", "renderer");
    telemetry.gauge(RENDERER_METRICS.jsHeapTotalBytes, memory.totalJSHeapSize, "bytes", "renderer");
    telemetry.gauge(RENDERER_METRICS.jsHeapLimitBytes, memory.jsHeapSizeLimit, "bytes", "renderer");
  }
}
