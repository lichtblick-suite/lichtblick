// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  buildOverheadReport,
  computeOverheadDeltas,
  isOverheadGateEnabled,
  overheadFileName,
} from "./overhead";
import type { OverheadRunStats } from "./types";
import { BenchmarkResultV1, HostProcessSample, buildResultV1 } from "../result/schemaV1";

const MIB = 1024 * 1024;

function stats(overrides: Partial<OverheadRunStats>): OverheadRunStats {
  return {
    telemetryEnabled: true,
    hostPolls: 5,
    medianTotalCpuPercent: 100,
    meanTotalWorkingSetBytes: 500 * MIB,
    peakTotalWorkingSetBytes: 600 * MIB,
    ...overrides,
  };
}

function resultWith({
  telemetryEnabled,
  cpu,
  ws,
}: {
  telemetryEnabled: boolean;
  cpu: number;
  ws: number;
}): BenchmarkResultV1 {
  const hostSamples: HostProcessSample[] = [1000, 2000, 3000].map((monotonicTs) => ({
    monotonicTs,
    pid: 1,
    processType: "renderer",
    workingSetBytes: ws,
    cpuPercent: cpu,
  }));
  return buildResultV1({
    run: {
      scenarioId: "sinewave",
      pipeline: "synthetic",
      platform: "web",
      telemetryEnabled,
      startedAtWall: "2026-01-01T00:00:00.000Z",
      finishedAtWall: "2026-01-01T00:00:05.000Z",
      startMonotonicTs: 0,
      endMonotonicTs: 5000,
      sampleIntervalMs: 1000,
      environment: { os: "linux", arch: "x64", ci: false, cpuModel: "cpu", totalMemBytes: 1 },
    },
    pageRecords: [],
    drainedDropped: 0,
    drainRealm: "renderer",
    hostSamples,
    listenerDispatchSamples: [],
  });
}

describe("computeOverheadDeltas", () => {
  it("computes absolute and relative CPU deltas and the memory delta", () => {
    // Given off at 100 % CPU / 500 MiB and on at 101 % / 510 MiB
    const off = stats({ telemetryEnabled: false });
    const on = stats({ medianTotalCpuPercent: 101, meanTotalWorkingSetBytes: 510 * MIB });

    // When
    const deltas = computeOverheadDeltas(off, on);

    // Then
    expect(deltas.cpuDeltaPctPoints).toBeCloseTo(1);
    expect(deltas.cpuDeltaRelative).toBeCloseTo(0.01);
    expect(deltas.memDeltaBytes).toBe(10 * MIB);
  });

  it("handles a zero CPU baseline", () => {
    // Given / When / Then
    expect(
      computeOverheadDeltas(
        stats({ medianTotalCpuPercent: 0 }),
        stats({ medianTotalCpuPercent: 0 }),
      ).cpuDeltaRelative,
    ).toBe(0);
    expect(
      computeOverheadDeltas(
        stats({ medianTotalCpuPercent: 0 }),
        stats({ medianTotalCpuPercent: 5 }),
      ).cpuDeltaRelative,
    ).toBeUndefined();
  });
});

describe("buildOverheadReport", () => {
  it("is within targets for small deltas", () => {
    // Given
    const off = resultWith({ telemetryEnabled: false, cpu: 100, ws: 500 * MIB });
    const on = resultWith({ telemetryEnabled: true, cpu: 101.5, ws: 515 * MIB });

    // When
    const report = buildOverheadReport({
      platform: "web",
      scenarioId: "sinewave",
      off,
      on,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    // Then
    expect(report).toMatchObject({
      schemaVersion: 1,
      kind: "overhead",
      platform: "web",
      scenarioId: "sinewave",
      createdAtWall: "2026-01-01T00:00:00.000Z",
      off: { telemetryEnabled: false, hostPolls: 3, medianTotalCpuPercent: 100 },
      on: { telemetryEnabled: true, medianTotalCpuPercent: 101.5 },
      targets: { cpuDeltaRelativeMax: 0.02, memDeltaBytesMax: 20 * MIB },
      within: { cpu: true, memory: true },
      withinTargets: true,
    });
  });

  it("flags CPU and memory regressions independently", () => {
    // Given 5 % more CPU and 30 MiB more memory
    const off = resultWith({ telemetryEnabled: false, cpu: 100, ws: 500 * MIB });
    const on = resultWith({ telemetryEnabled: true, cpu: 105, ws: 530 * MIB });

    // When
    const report = buildOverheadReport({ platform: "electron", scenarioId: "x", off, on });

    // Then
    expect(report.within).toEqual({ cpu: false, memory: false });
    expect(report.withinTargets).toBe(false);
  });
});

describe("overheadFileName / isOverheadGateEnabled", () => {
  it("formats the file name and reads the gate env", () => {
    // Given / When / Then
    expect(overheadFileName("web", "sinewave", 42)).toBe("overhead-web-sinewave-42.json");
    expect(isOverheadGateEnabled({ BENCHMARK_OVERHEAD_GATE: "1" })).toBe(true);
    expect(isOverheadGateEnabled({})).toBe(false);
  });
});
