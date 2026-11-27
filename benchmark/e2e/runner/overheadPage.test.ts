// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { withOverheadFields } from "./overheadPage";
import type { OverheadResultFields } from "./overheadPage.types";
import { BenchmarkResultBuilder } from "../report/builders/BenchmarkResultBuilder";
import { TelemetryRecordBuilder } from "../result/builders/TelemetryRecordBuilder";
import { TELEMETRY_SELF_TIME_METRICS } from "../result/constants";
import type { HostProcessSample } from "../result/schemaV1";
import { validateResultV1 } from "../result/schemaV1";

const MIB = 1024 * 1024;

function host(monotonicTs: number, cpuPercent: number): HostProcessSample {
  return { monotonicTs, pid: 1, processType: "browser", workingSetBytes: 400 * MIB, cpuPercent };
}

function fields(overrides: Partial<OverheadResultFields> = {}): OverheadResultFields {
  return {
    recording: {
      pollTimestamps: [2000, 3000],
      overruns: 0,
      maxPollLatencyMs: 40,
      clockSyncRttMs: 3,
      startMonotonicTs: 1000,
      endMonotonicTs: 3000,
      mainThreadStart: { longTaskMs: 0, frames: 0, nowMs: 1000 },
      mainThreadEnd: { longTaskMs: 20, frames: 120, nowMs: 3000 },
    },
    measurement: { mode: "steady", warmupMs: 3000, polls: 2 },
    pageState: { collectors: { uaMemory: "unsupported" } },
    hostSamples: [host(1000, 500), host(2000, 100), host(3000, 120)],
    pageRecords: TelemetryRecordBuilder.counterSeries(TELEMETRY_SELF_TIME_METRICS.frames, [
      [1000, 0],
      [3000, 4],
    ]),
    ...overrides,
  };
}

describe("withOverheadFields", () => {
  it("should add the steady window, collectors and self-cost to a telemetry-on result", () => {
    // Given
    const scenarioRun = BenchmarkResultBuilder.result({ telemetryEnabled: true });
    const result = { ...scenarioRun, run: { ...scenarioRun.run, mode: "overhead" as const } };

    // When
    const withFields = withOverheadFields(result, fields());

    // Then
    expect(withFields.summary.steadyWindow).toMatchObject({
      polls: 2,
      requestedPolls: 2,
      windowMismatch: false,
      maxPollLatencyMs: 40,
      clockSyncRttMs: 3,
      medianTotalCpuPercent: 110,
      meanTotalWorkingSetBytes: 400 * MIB,
      processSet: { browser: 1 },
      mainThread: { longTaskBlockedMsPerSec: 10, fps: 60 },
    });
    expect(withFields.summary.telemetrySelf?.msPerSec.byComponent).toEqual({ frames: 2 });
    expect(withFields.run.environment.collectors).toEqual({ uaMemory: "unsupported" });
    expect(validateResultV1(withFields)).toEqual([]);
  });

  it("should omit the self-cost with telemetry off and keep the result otherwise unchanged", () => {
    // Given
    const result = BenchmarkResultBuilder.result({ telemetryEnabled: false });

    // When
    const withFields = withOverheadFields(result, fields({ pageState: {} }));

    // Then
    expect(withFields.summary.telemetrySelf).toBeUndefined();
    expect(withFields.run.environment).toEqual(result.run.environment);
    expect(withFields.summary.steadyWindow?.polls).toBe(2);
    expect({ ...withFields, summary: result.summary }).toEqual(result);
  });

  it("should mark a window mismatch when polls are missing", () => {
    // Given only one of two steady polls has host samples
    const result = BenchmarkResultBuilder.result({ telemetryEnabled: true });

    // When
    const withFields = withOverheadFields(
      result,
      fields({ hostSamples: [host(1000, 500), host(2000, 100)] }),
    );

    // Then
    expect(withFields.summary.steadyWindow).toMatchObject({ polls: 1, windowMismatch: true });
  });
});
