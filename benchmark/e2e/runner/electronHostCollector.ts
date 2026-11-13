// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { ElectronApplication, Page } from "@playwright/test";

import { KB } from "./constants";
import { logicalCpuCount, toPerCoreSumPercent } from "./hostCpus";
import type { CumulativeCpuReading } from "./toggleBlocks.types";
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
 * (converted to bytes here) and `percentCPUUsage` since the previous `getAppMetrics()` call,
 * divided by the host's `logicalCpus`: it is multiplied back so `cpuPercent` is a per-core sum
 * (100 % = one full core) like on web. `privateBytes` is only reported on Windows.
 */
export function mapElectronMetrics(
  metrics: readonly LegacyProcessMetric[],
  monotonicTs: number,
  logicalCpus: number,
): HostProcessSample[] {
  const samples: HostProcessSample[] = [];
  for (const metric of metrics) {
    const sample: HostProcessSample = {
      monotonicTs,
      pid: metric.pid,
      processType: mapElectronProcessType(metric.type),
      workingSetBytes: metric.memory.workingSetSize * KB,
      peakWorkingSetBytes: metric.memory.peakWorkingSetSize * KB,
      cpuPercent: toPerCoreSumPercent(metric.cpu.percentCPUUsage, logicalCpus),
    };
    if (metric.memory.privateBytes != undefined) {
      sample.privateBytes = metric.memory.privateBytes * KB;
    }
    samples.push(sample);
  }
  return samples;
}

/**
 * Polls `window.lichtblickBenchmark.getMemoryMetrics()` (benchmark Electron preload bridge). The
 * legacy metrics stay Electron's raw `ProcessMetric`s (`percentCPUUsage` divided by `logicalCpus`).
 */
export async function collectElectronHostMetrics(
  page: Page,
  monotonicTs: number,
  logicalCpus: number = logicalCpuCount(),
): Promise<HostMetricsSnapshot> {
  const legacyMetrics = await page.evaluate(async () => {
    const bridge = (window as unknown as { lichtblickBenchmark: LichtblickBenchmarkBridge })
      .lichtblickBenchmark;
    return await bridge.getMemoryMetrics();
  });
  return { samples: mapElectronMetrics(legacyMetrics, monotonicTs, logicalCpus), legacyMetrics };
}

/**
 * `app.getAppMetrics()` read directly in the Electron main process (no renderer round trip): same
 * data as `collectElectronHostMetrics` (whose preload IPC handler returns it unchanged), but a busy
 * renderer main thread cannot delay it. Used by the overhead steady window.
 */
export async function collectElectronMainProcessMetrics(
  electronApp: Pick<ElectronApplication, "evaluate">,
  monotonicTs: number,
  logicalCpus: number = logicalCpuCount(),
): Promise<HostMetricsSnapshot> {
  const legacyMetrics: LegacyProcessMetric[] = await electronApp.evaluate(({ app }) =>
    app.getAppMetrics(),
  );
  return { samples: mapElectronMetrics(legacyMetrics, monotonicTs, logicalCpus), legacyMetrics };
}

/**
 * Cumulative CPU readings of `app.getAppMetrics()` entries (`cpu.cumulativeCPUUsage`, CPU seconds
 * since the process started; not divided by the CPU count, i.e. a per-core sum). Throws when an
 * entry lacks it (optional in Electron's typings; `percentCPUUsage` is "since the previous call"
 * and cannot replace it).
 */
export function mapElectronCumulativeCpu(
  metrics: readonly Pick<LegacyProcessMetric, "pid" | "type" | "cpu">[],
): CumulativeCpuReading[] {
  return metrics.map((metric) => {
    const cpuTimeSec = metric.cpu.cumulativeCPUUsage;
    if (cpuTimeSec == undefined || !Number.isFinite(cpuTimeSec)) {
      throw new Error(
        `app.getAppMetrics() has no cpu.cumulativeCPUUsage for ${metric.type} ` +
          `pid ${metric.pid}; the toggle A/B needs it (use BENCHMARK_OVERHEAD_METHOD=relaunch)`,
      );
    }
    return { pid: metric.pid, processType: mapElectronProcessType(metric.type), cpuTimeSec };
  });
}

/** Cumulative CPU of every Electron app process, read in the main process (no page call). */
export async function readElectronCumulativeCpu(
  electronApp: Pick<ElectronApplication, "evaluate">,
): Promise<CumulativeCpuReading[]> {
  const metrics = await electronApp.evaluate(({ app }) =>
    app.getAppMetrics().map(({ pid, type, cpu }) => ({
      pid,
      type,
      cpu: { percentCPUUsage: cpu.percentCPUUsage, cumulativeCPUUsage: cpu.cumulativeCPUUsage },
    })),
  );
  return mapElectronCumulativeCpu(metrics);
}
