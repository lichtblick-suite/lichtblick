// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { HostProcessSample } from "./schemaV1";
import { hasWorkingSet, mainThreadRates, summarizeSteadyWindow } from "./steadyWindow";
import type { SteadyWindowInput } from "./steadyWindow.types";

const MIB = 1024 * 1024;

function host(
  monotonicTs: number,
  processType: string,
  workingSetBytes: number,
  cpuPercent: number,
  pid = 1,
): HostProcessSample {
  return { monotonicTs, pid, processType, workingSetBytes, cpuPercent };
}

function input(overrides: Partial<SteadyWindowInput>): SteadyWindowInput {
  return {
    hostSamples: [],
    pollTimestamps: [],
    requestedPolls: 2,
    overruns: 0,
    warmupMs: 3000,
    startMonotonicTs: 1000,
    endMonotonicTs: 3000,
    ...overrides,
  };
}

describe("mainThreadRates", () => {
  it("should convert reading deltas to long-task ms/s and fps", () => {
    // Given two readings two seconds apart
    const start = { longTaskMs: 100, frames: 10, nowMs: 1000 };
    const end = { longTaskMs: 160, frames: 130, nowMs: 3000 };

    // When
    const rates = mainThreadRates(start, end);

    // Then
    expect(rates).toEqual({ longTaskBlockedMsPerSec: 30, fps: 60 });
  });

  it("should return undefined without both readings or for a non-positive interval", () => {
    // Given
    const reading = { longTaskMs: 0, frames: 0, nowMs: 1000 };

    // When / Then
    expect(mainThreadRates(undefined, reading)).toBeUndefined();
    expect(mainThreadRates(reading, reading)).toBeUndefined();
  });
});

describe("summarizeSteadyWindow", () => {
  it("should aggregate the steady polls only, per poll over processes", () => {
    // Given a priming poll at 1000 (ignored) and two steady polls with two renderers in the second
    const hostSamples = [
      host(1000, "browser", 999 * MIB, 999),
      host(2000, "browser", 100 * MIB, 10),
      host(2000, "renderer", 200 * MIB, 30, 2),
      host(3000, "browser", 100 * MIB, 20),
      host(3000, "renderer", 300 * MIB, 50, 2),
      host(3000, "renderer", 100 * MIB, 10, 3),
    ];

    // When
    const summary = summarizeSteadyWindow(input({ hostSamples, pollTimestamps: [2000, 3000] }));

    // Then
    expect(summary.polls).toBe(2);
    expect(summary.windowMismatch).toBe(false);
    expect(summary.medianTotalCpuPercent).toBe(60);
    expect(summary.meanTotalCpuPercent).toBe(60);
    expect(summary.meanTotalWorkingSetBytes).toBe(400 * MIB);
    expect(summary.peakTotalWorkingSetBytes).toBe(500 * MIB);
    expect(summary.meanWorkingSetBytesByType).toEqual({ browser: 100 * MIB, renderer: 300 * MIB });
    expect(summary.processSet).toEqual({ browser: 1, renderer: 2 });
    expect(summary.mainThread).toBeUndefined();
  });

  it("should flag a window mismatch for missing polls or overruns", () => {
    // Given one of two requested polls reported, and a full window with an overrun
    const hostSamples = [host(2000, "browser", MIB, 1), host(3000, "browser", MIB, 1)];

    // When
    const missing = summarizeSteadyWindow(input({ hostSamples, pollTimestamps: [2000, 2500] }));
    const overrun = summarizeSteadyWindow(
      input({ hostSamples, pollTimestamps: [2000, 3000], overruns: 1 }),
    );

    // Then
    expect(missing.polls).toBe(1);
    expect(missing.windowMismatch).toBe(true);
    expect(overrun.polls).toBe(2);
    expect(overrun.windowMismatch).toBe(true);
  });

  it("should flag a window mismatch when a poll has no CPU", () => {
    // Given two polls whose second one has a working set but no CPU (CPU collection failed)
    const hostSamples: HostProcessSample[] = [
      host(2000, "browser", MIB, 1),
      { monotonicTs: 3000, pid: 1, processType: "browser", workingSetBytes: MIB },
    ];

    // When
    const summary = summarizeSteadyWindow(input({ hostSamples, pollTimestamps: [2000, 3000] }));

    // Then
    expect(summary.windowMismatch).toBe(true);
  });

  it("should leave memory unmeasured when no poll has a working set", () => {
    // Given two polls with CPU only (working-set collection failed)
    const hostSamples: HostProcessSample[] = [
      { monotonicTs: 2000, pid: 1, processType: "browser", cpuPercent: 10 },
      { monotonicTs: 3000, pid: 1, processType: "browser", cpuPercent: 20 },
    ];

    // When
    const summary = summarizeSteadyWindow(input({ hostSamples, pollTimestamps: [2000, 3000] }));

    // Then
    expect(hasWorkingSet(summary)).toBe(false);
    expect(summary.windowMismatch).toBe(false);
    expect(summary.medianTotalCpuPercent).toBe(15);
  });

  it("should report memory as measured when a poll has a working set", () => {
    // Given
    const hostSamples = [host(2000, "browser", MIB, 1), host(3000, "browser", MIB, 1)];

    // When
    const summary = summarizeSteadyWindow(input({ hostSamples, pollTimestamps: [2000, 3000] }));

    // Then
    expect(hasWorkingSet(summary)).toBe(true);
  });

  it("should carry the poll latency and clock sync diagnostics when recorded", () => {
    // Given
    const hostSamples = [host(2000, "browser", MIB, 1), host(3000, "browser", MIB, 1)];

    // When
    const recorded = summarizeSteadyWindow(
      input({ hostSamples, pollTimestamps: [2000, 3000], maxPollLatencyMs: 85, clockSyncRttMs: 4 }),
    );
    const older = summarizeSteadyWindow(input({ hostSamples, pollTimestamps: [2000, 3000] }));

    // Then
    expect(recorded).toMatchObject({ maxPollLatencyMs: 85, clockSyncRttMs: 4 });
    expect(older).not.toHaveProperty("maxPollLatencyMs");
    expect(older).not.toHaveProperty("clockSyncRttMs");
  });

  it("should include the main-thread rates when both probe readings exist", () => {
    // Given
    const mainThreadStart = { longTaskMs: 0, frames: 0, nowMs: 0 };
    const mainThreadEnd = { longTaskMs: 50, frames: 600, nowMs: 10_000 };

    // When
    const summary = summarizeSteadyWindow(input({ mainThreadStart, mainThreadEnd }));

    // Then
    expect(summary.mainThread).toEqual({ longTaskBlockedMsPerSec: 5, fps: 60 });
    expect(summary.polls).toBe(0);
    expect(summary.windowMismatch).toBe(true);
    expect(summary.medianTotalCpuPercent).toBe(0);
  });
});
