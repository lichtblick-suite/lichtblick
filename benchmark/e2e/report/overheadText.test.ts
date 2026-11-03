// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { BenchmarkResultBuilder } from "./builders/BenchmarkResultBuilder";
import { MEM_NOT_MEASURED, NONE, OVERHEAD_UNITS } from "./constants";
import {
  cpuSamplesText,
  cpuVerdictStats,
  memDeltaText,
  methodText,
  overheadFlagsText,
  reportFlagsText,
  selfCostText,
  toggleConfigText,
  toggleFlagsText,
  toggleProcessDeltasText,
} from "./overheadText";
import { normalizeOverheadReport } from "../result/overheadLegacy";
import { OverheadRunBuilder } from "../runner/builders/OverheadRunBuilder";
import type { OverheadArmProps } from "../runner/builders/OverheadRunBuilder";
import { ToggleBlockBuilder } from "../runner/builders/ToggleBlockBuilder";
import { buildOverheadReport } from "../runner/overhead";
import type {
  OverheadReport,
  OverheadRunInput,
  OverheadSelfCostSummary,
} from "../runner/overhead.types";
import { summarizeToggle } from "../runner/toggleBlocks";

function selfCost(overrides: Partial<OverheadSelfCostSummary> = {}): OverheadSelfCostSummary {
  return {
    n: 3,
    msPerSec: 2,
    fractionOfCore: 0.002,
    recordsPerSec: 100,
    meanEmitNs: 200,
    uaCalls: 0,
    ...overrides,
  };
}

describe("selfCostText", () => {
  it("should show the dash without a self-cost summary", () => {
    // Given / When / Then
    expect(selfCostText(undefined)).toBe(NONE);
  });

  it("should omit the UA probe when it was never called", () => {
    // Given
    const summary = selfCost();

    // When
    const text = selfCostText(summary);

    // Then
    expect(text).toBe("2.00 ms/s (0.20 % core) · 100 rec/s · 200 ns/rec");
  });

  it("should show UA probe calls, outcomes and the resolve latency", () => {
    // Given
    const summary = selfCost({ uaCalls: 2, uaResolved: 1, uaFailures: 0, uaResolveMsMean: 12_345 });

    // When
    const text = selfCostText(summary);

    // Then
    expect(text).toBe(
      "2.00 ms/s (0.20 % core) · 100 rec/s · 200 ns/rec · UA 2 calls · 1 resolved · 12.3 s to resolve",
    );
  });

  it("should show rejected UA probe calls without a latency", () => {
    // Given
    const summary = selfCost({ uaCalls: 1, uaResolved: 0, uaFailures: 1 });

    // When
    const text = selfCostText(summary);

    // Then
    expect(text).toContain("UA 1 calls · 0 resolved · 1 rejected");
    expect(text).not.toContain("to resolve");
  });
});

function reportOf(runs: OverheadRunInput[]): OverheadReport {
  return buildOverheadReport({
    platform: "web",
    scenarioId: "pointcloud",
    runs,
    config: OverheadRunBuilder.config(),
  });
}

describe("overheadFlagsText", () => {
  it("should return the placeholder without mismatches or poll latencies", () => {
    // Given older runs without a poll latency and no mismatch
    const report = reportOf(OverheadRunBuilder.abba([{}, {}]));

    // When / Then
    expect(overheadFlagsText(report)).toBe(NONE);
  });

  it("should list the window mismatch reason of each excluded run", () => {
    // Given repeat 1's on run overran twice and repeat 0's off run missed polls
    const overran: OverheadArmProps = { windowMismatch: true, overruns: 2 };
    const report = reportOf(
      OverheadRunBuilder.abba([{ off: { windowMismatch: true } }, { on: overran }]),
    );

    // When
    const text = overheadFlagsText(report);

    // Then
    expect(text).toBe(
      "2 window mismatch run(s) (r0 off: 8/10 polls; r1 on: 8/10 polls, 2 overrun(s))",
    );
  });

  it("should show the longest host poll over all runs", () => {
    // Given runs reporting their longest host poll
    const report = reportOf(
      OverheadRunBuilder.abba([
        { off: { maxPollLatencyMs: 40 }, on: { maxPollLatencyMs: 85.4 } },
        { off: { maxPollLatencyMs: 12 } },
      ]),
    );

    // When / Then
    expect(overheadFlagsText(report)).toBe("max poll 85 ms");
  });

  it("should join mismatches, process-set mismatches and the poll latency", () => {
    // Given a report with every kind of flag
    const report: OverheadReport = {
      ...reportOf(
        OverheadRunBuilder.abba([{ on: { windowMismatch: true, maxPollLatencyMs: 1200 } }]),
      ),
      processSetMismatches: 1,
    };

    // When / Then
    expect(overheadFlagsText(report)).toBe(
      "1 window mismatch run(s) (r0 on: 8/10 polls), 1 process-set mismatch(es), max poll 1200 ms",
    );
  });
});

describe("cpuVerdictStats", () => {
  it("should read the toggle A/B when it gave the CPU verdict", () => {
    // Given a both-method report: relaunch +1 %, toggle +2 %
    const toggle = ToggleBlockBuilder.summary(
      Array.from({ length: 6 }, () => ({ off: 100, on: 102 })),
    );
    const report = BenchmarkResultBuilder.overhead({ method: "both", toggle });

    // When
    const stats = cpuVerdictStats(report);

    // Then
    expect(stats).toMatchObject({ source: "toggle", n: 6, excluded: 0 });
    expect(stats.cpuRelative.median).toBeCloseTo(0.02, 10);
    expect(stats.cpuPctPoints.median).toBeCloseTo(2, 10);
  });

  it("should read the relaunch A/B otherwise, keeping the legacy marker", () => {
    // Given
    const relaunch = BenchmarkResultBuilder.overhead();
    const legacy = normalizeOverheadReport(OverheadRunBuilder.legacyReport())!;

    // When / Then
    expect(cpuVerdictStats(relaunch)).toMatchObject({ source: "relaunch", n: 5 });
    expect(cpuVerdictStats(relaunch).cpuRelative.median).toBeCloseTo(0.01, 10);
    expect(cpuVerdictStats(legacy)).toMatchObject({ source: "relaunch", n: 1, legacy: true });
  });
});

describe("cpuSamplesText", () => {
  it("should count toggle quartets with their unit and the excluded ones", () => {
    // Given 4 quartets, the first with a process change
    const toggle = summarizeToggle({
      recordings: ToggleBlockBuilder.abba(
        Array.from({ length: 4 }, () => ({ off: 100, on: 101 })),
        (index) => (index === 0 ? { processSetChanged: true } : {}),
      ),
      records: [],
      config: ToggleBlockBuilder.config({ quartets: 4 }),
      cpuDeltaRelativeMax: 0.02,
    });
    const report = BenchmarkResultBuilder.overhead({ method: "toggle", toggle });

    // When / Then
    expect(cpuSamplesText(cpuVerdictStats(report))).toBe("3 quartets (1 excl.)");
  });

  it("should count relaunch pairs without a unit", () => {
    // Given / When / Then
    expect(cpuSamplesText(cpuVerdictStats(BenchmarkResultBuilder.overhead()))).toBe("5");
  });
});

describe("methodText / memDeltaText", () => {
  it("should name the method and the verdict sources", () => {
    // Given / When / Then
    expect(methodText(BenchmarkResultBuilder.overhead())).toBe("relaunch");
    expect(methodText(BenchmarkResultBuilder.overhead({ method: "toggle" }))).toBe(
      `toggle (mem ${MEM_NOT_MEASURED})`,
    );
    expect(methodText(BenchmarkResultBuilder.overhead({ method: "both" }))).toBe(
      "both (CPU toggle · mem relaunch)",
    );
  });

  it("should show the relaunch memory delta, or not measured for method toggle", () => {
    // Given
    const both = BenchmarkResultBuilder.overhead({ method: "both" });
    const toggle = BenchmarkResultBuilder.overhead({ method: "toggle" });

    // When / Then
    expect(memDeltaText(both, OVERHEAD_UNITS.memMiB)).toBe("+5.0 MiB [+5.0, +5.0]");
    expect(memDeltaText(toggle, OVERHEAD_UNITS.memMiB)).toBe(MEM_NOT_MEASURED);
  });
});

describe("toggleConfigText / toggleFlagsText", () => {
  it("should describe the toggle settings", () => {
    // Given / When / Then
    expect(toggleConfigText({ config: ToggleBlockBuilder.config({ quartets: 10 }) })).toBe(
      "10 ABBA quartets × 4 × 3000 ms blocks (500 ms settle)",
    );
  });

  it("should show only the toggle latency for a clean run", () => {
    // Given / When / Then
    expect(toggleFlagsText(ToggleBlockBuilder.summary())).toBe("toggle ≤ 5 ms");
  });

  it("should list flagged blocks, late starts, UA calls and renderer records in off blocks", () => {
    // Given
    const toggle = {
      ...ToggleBlockBuilder.summary(),
      toggleLatencyMsMax: 640.4,
      flaggedBlocks: 2,
      lateStartBlocks: 1,
      uaCalls: { onBlocks: 3, offBlocks: 1 },
      rendererRecords: { onBlocks: 900, offBlocks: 4 },
    };

    // When / Then
    expect(toggleFlagsText(toggle)).toBe(
      "toggle ≤ 640 ms · 2 flagged block(s) (process set) · 1 late start(s) · UA 3 calls in on blocks, 1 in off blocks · 4 renderer record(s) in off blocks",
    );
  });
});

describe("toggleProcessDeltasText", () => {
  it("should show the top 3 process types by |mean| with their positive quartets", () => {
    // Given: GPU +0.9, browser +0.6, renderer −0.1, utility +0.01 pp in every quartet
    const toggle = ToggleBlockBuilder.summary(
      undefined,
      ToggleBlockBuilder.processSplit(
        {
          off: { renderer: 20, gpu: 2, browser: 1, utility: 0.5 },
          on: { renderer: 19.9, gpu: 2.9, browser: 1.6, utility: 0.51 },
        },
        6,
      ),
    );

    // When
    const text = toggleProcessDeltasText(toggle);

    // Then
    expect(text).toBe(
      "gpu +0.90 pp (6/6 ↑) · browser +0.60 pp (6/6 ↑) · renderer -0.10 pp (0/6 ↑)",
    );
  });

  it("should show none without the per-type split", () => {
    // Given / When / Then
    expect(toggleProcessDeltasText(ToggleBlockBuilder.summary())).toBe(NONE);
  });
});

describe("reportFlagsText", () => {
  it("should join the toggle flags with the relaunch runs' flags", () => {
    // Given a both-method report whose relaunch runs report a max poll
    const report = BenchmarkResultBuilder.overhead({ method: "both" });
    const withPoll: OverheadReport = {
      ...report,
      runs: report.runs.map((run) => ({
        ...run,
        steady: { ...run.steady, maxPollLatencyMs: 30 },
      })),
    };

    // When / Then
    expect(reportFlagsText(withPoll)).toBe("toggle ≤ 5 ms; max poll 30 ms");
  });

  it("should show only the toggle flags without relaunch runs, the dash with nothing", () => {
    // Given / When / Then
    expect(reportFlagsText(BenchmarkResultBuilder.overhead({ method: "toggle" }))).toBe(
      "toggle ≤ 5 ms",
    );
    expect(reportFlagsText(BenchmarkResultBuilder.overhead())).toBe(NONE);
  });
});
