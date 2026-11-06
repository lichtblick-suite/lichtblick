// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { ElectronApplication } from "@playwright/test";

import {
  collectElectronMainProcessMetrics,
  mapElectronCumulativeCpu,
  mapElectronMetrics,
  mapElectronProcessType,
  readElectronCumulativeCpu,
} from "./electronHostCollector";
import type { LegacyProcessMetric } from "../types";

function metric(overrides: Partial<LegacyProcessMetric> = {}): LegacyProcessMetric {
  return {
    pid: 1,
    type: "Browser",
    memory: { workingSetSize: 100, peakWorkingSetSize: 150 },
    cpu: { percentCPUUsage: 12.5 },
    ...overrides,
  };
}

describe("mapElectronProcessType", () => {
  it.each([
    ["Browser", "browser"],
    ["Tab", "renderer"],
    ["GPU", "gpu"],
    ["Utility", "utility"],
    ["Worker", "utility"],
    ["Pepper Plugin", "utility"],
    ["Zygote", "zygote"],
    ["Sandbox helper", "sandbox-helper"],
  ])("maps %s to %s", (type, expected) => {
    // Given an Electron process type / When mapped / Then
    expect(mapElectronProcessType(type)).toBe(expected);
  });
});

describe("mapElectronMetrics", () => {
  it("converts KB to bytes, keeps pid and type, and scales CPU to a per-core sum", () => {
    // Given a Windows-style metric with privateBytes and a Linux-style one without, on 8 CPUs
    const metrics = [
      metric({ memory: { workingSetSize: 100, peakWorkingSetSize: 150, privateBytes: 80 } }),
      metric({ pid: 2, type: "Tab", cpu: { percentCPUUsage: 3 } }),
    ];

    // When
    const samples = mapElectronMetrics(metrics, 1234, 8);

    // Then CPU is Electron's percent of all CPUs times the logical CPU count
    expect(samples).toEqual([
      {
        monotonicTs: 1234,
        pid: 1,
        processType: "browser",
        workingSetBytes: 102_400,
        peakWorkingSetBytes: 153_600,
        privateBytes: 81_920,
        cpuPercent: 100,
      },
      {
        monotonicTs: 1234,
        pid: 2,
        processType: "renderer",
        workingSetBytes: 102_400,
        peakWorkingSetBytes: 153_600,
        cpuPercent: 24,
      },
    ]);
  });

  it("does not modify the raw Electron metrics", () => {
    // Given
    const metrics = [metric()];

    // When
    mapElectronMetrics(metrics, 0, 4);

    // Then the legacy artifact keeps Electron's raw percentCPUUsage
    expect(metrics[0]!.cpu.percentCPUUsage).toBe(12.5);
  });
});

describe("collectElectronMainProcessMetrics", () => {
  it("reads app.getAppMetrics() in the main process and maps it", async () => {
    // Given a main process whose app reports one browser process
    const raw = [metric({ cpu: { percentCPUUsage: 10 } })];
    const evaluate = jest.fn(
      async (fn: (electron: { app: { getAppMetrics: () => LegacyProcessMetric[] } }) => unknown) =>
        fn({ app: { getAppMetrics: () => raw } }),
    );
    const electronApp = { evaluate } as unknown as Pick<ElectronApplication, "evaluate">;

    // When
    const snapshot = await collectElectronMainProcessMetrics(electronApp, 42, 4);

    // Then: one main-process call, raw legacy metrics, per-core-sum samples
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(snapshot.legacyMetrics).toBe(raw);
    expect(snapshot.samples).toEqual([
      {
        monotonicTs: 42,
        pid: 1,
        processType: "browser",
        workingSetBytes: 102_400,
        peakWorkingSetBytes: 153_600,
        cpuPercent: 40,
      },
    ]);
  });
});

describe("mapElectronCumulativeCpu", () => {
  it("keeps the cumulative CPU seconds per pid with the cross-platform process type", () => {
    // Given
    const metrics = [
      metric({ pid: 1, type: "Browser", cpu: { percentCPUUsage: 3, cumulativeCPUUsage: 12.5 } }),
      metric({ pid: 2, type: "Tab", cpu: { percentCPUUsage: 9, cumulativeCPUUsage: 40 } }),
    ];

    // When
    const readings = mapElectronCumulativeCpu(metrics);

    // Then
    expect(readings).toEqual([
      { pid: 1, processType: mapElectronProcessType("Browser"), cpuTimeSec: 12.5 },
      { pid: 2, processType: mapElectronProcessType("Tab"), cpuTimeSec: 40 },
    ]);
  });

  it("throws a clear error when the Electron version lacks cumulativeCPUUsage", () => {
    // Given
    const metrics = [metric({ pid: 7, type: "GPU", cpu: { percentCPUUsage: 1 } })];

    // When / Then
    expect(() => mapElectronCumulativeCpu(metrics)).toThrow(
      "app.getAppMetrics() has no cpu.cumulativeCPUUsage for GPU pid 7; the toggle A/B needs it " +
        "(use BENCHMARK_OVERHEAD_METHOD=relaunch)",
    );
  });
});

describe("readElectronCumulativeCpu", () => {
  it("reads app.getAppMetrics() in the main process, one call per reading", async () => {
    // Given
    const raw = [metric({ cpu: { percentCPUUsage: 10, cumulativeCPUUsage: 3 } })];
    const evaluate = jest.fn(
      async (fn: (electron: { app: { getAppMetrics: () => LegacyProcessMetric[] } }) => unknown) =>
        fn({ app: { getAppMetrics: () => raw } }),
    );
    const electronApp = { evaluate } as unknown as Pick<ElectronApplication, "evaluate">;

    // When
    const readings = await readElectronCumulativeCpu(electronApp);

    // Then
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(readings).toEqual([{ pid: 1, processType: "browser", cpuTimeSec: 3 }]);
  });
});
