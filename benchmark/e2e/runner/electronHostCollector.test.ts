// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { mapElectronMetrics, mapElectronProcessType } from "./electronHostCollector";
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
