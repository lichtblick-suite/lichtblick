// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { isOverheadRun, scenarioRunsOnly } from "./runMode";
import { BenchmarkResultBuilder } from "../report/builders/BenchmarkResultBuilder";

describe("isOverheadRun", () => {
  it("should classify by run.mode when present", () => {
    // Given
    const scenario = BenchmarkResultBuilder.result({ mode: "scenario" });
    const overhead = BenchmarkResultBuilder.result({ mode: "overhead" });

    // When / Then
    expect(isOverheadRun(scenario)).toBe(false);
    expect(isOverheadRun(overhead)).toBe(true);
  });

  it("should recognize a partial overhead result without a steady window by its mode", () => {
    // Given a failed overhead run (written before its steady window was measured)
    const { summary, run } = BenchmarkResultBuilder.result({ mode: "scenario" });
    const partial = { run: { ...run, mode: "overhead" as const }, summary };

    // When / Then
    expect(isOverheadRun(partial)).toBe(true);
  });

  it("should fall back to the steady window for results written before run.mode", () => {
    // Given
    const { run: legacyRun, summary: legacySummary } = BenchmarkResultBuilder.legacy();
    const { summary: steadySummary } = BenchmarkResultBuilder.result({ mode: "overhead" });

    // When
    const scenario = isOverheadRun({ run: legacyRun, summary: legacySummary });
    const overhead = isOverheadRun({ run: legacyRun, summary: steadySummary });

    // Then
    expect(legacyRun.mode).toBeUndefined();
    expect(scenario).toBe(false);
    expect(overhead).toBe(true);
  });
});

describe("scenarioRunsOnly", () => {
  it("should drop the overhead runs and keep the order of the scenario runs", () => {
    // Given
    const web = BenchmarkResultBuilder.result({ platform: "web" });
    const overhead = BenchmarkResultBuilder.result({ mode: "overhead" });
    const electron = BenchmarkResultBuilder.result({ platform: "electron" });

    // When
    const kept = scenarioRunsOnly([web, overhead, electron]);

    // Then
    expect(kept).toEqual([web, electron]);
  });
});
