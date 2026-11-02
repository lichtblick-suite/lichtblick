// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { Page } from "@playwright/test";

import { KB } from "./constants";
import type { HostMetricsSnapshot, HostProcessSample } from "./types";
import type { LichtblickBenchmarkBridge } from "../../desktop/common/types";
import type { LegacyProcessMetric } from "../types";

/** Normalizes Electron's `ProcessMetric.type` to the cross-platform process types. */
export function mapElectronProcessType(type: string): string {
  switch (type) {
    case "Browser":
      return "browser";
    case "Tab":
      return "renderer";
    case "GPU":
      return "gpu";
    case "Utility":
    case "Worker":
    case "Pepper Plugin":
    case "Pepper Plugin Broker":
      return "utility";
    default:
      return type.toLowerCase().replace(/\s+/g, "-");
  }
}

/**
 * Maps `app.getAppMetrics()` entries to host process samples. Electron reports memory in KB
 * (converted to bytes here) and `percentCPUUsage` since the previous `getAppMetrics()` call.
 * `privateBytes` is only reported on Windows.
 */
export function mapElectronMetrics(
  metrics: readonly LegacyProcessMetric[],
  monotonicTs: number,
): HostProcessSample[] {
  const samples: HostProcessSample[] = [];
  for (const metric of metrics) {
    const sample: HostProcessSample = {
      monotonicTs,
      pid: metric.pid,
      processType: mapElectronProcessType(metric.type),
      workingSetBytes: metric.memory.workingSetSize * KB,
      peakWorkingSetBytes: metric.memory.peakWorkingSetSize * KB,
      cpuPercent: metric.cpu.percentCPUUsage,
    };
    if (metric.memory.privateBytes != undefined) {
      sample.privateBytes = metric.memory.privateBytes * KB;
    }
    samples.push(sample);
  }
  return samples;
}

/** Polls `window.lichtblickBenchmark.getMemoryMetrics()` (benchmark Electron preload bridge). */
export async function collectElectronHostMetrics(
  page: Page,
  monotonicTs: number,
): Promise<HostMetricsSnapshot> {
  const legacyMetrics = await page.evaluate(async () => {
    const bridge = (window as unknown as { lichtblickBenchmark: LichtblickBenchmarkBridge })
      .lichtblickBenchmark;
    return await bridge.getMemoryMetrics();
  });
  return { samples: mapElectronMetrics(legacyMetrics, monotonicTs), legacyMetrics };
}
