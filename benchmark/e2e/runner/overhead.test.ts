// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { OverheadRunBuilder } from "./builders/OverheadRunBuilder";
import { ToggleBlockBuilder } from "./builders/ToggleBlockBuilder";
import {
  buildOverheadReport,
  computeOverheadDeltas,
  overheadFileName,
  overheadFinalVerdicts,
  overheadRunFromResult,
} from "./overhead";
import type { OverheadArm, OverheadRunInput } from "./overhead.types";
import { armOrder } from "./overheadSchedule";
import { CpuProfileBuilder } from "../result/builders/CpuProfileBuilder";
import { MIN_PAIRS_FOR_VERDICT } from "../result/constants";

const MIB = 1024 * 1024;
const NOW = new Date("2026-01-02T03:04:05.000Z");

function run(props: Parameters<typeof OverheadRunBuilder.input>[0]) {
  return overheadRunFromResult(OverheadRunBuilder.input(props));
}

function report(runs: OverheadRunInput[], arms: OverheadArm[] = ["off", "on"]) {
  return buildOverheadReport({
    platform: "electron",
    scenarioId: "sinewave",
    runs,
    config: OverheadRunBuilder.config({ arms }),
    now: NOW,
  });
}

/** `count` identical repeats. */
function repeats(
  count: number,
  props: Parameters<typeof OverheadRunBuilder.abba>[0][number],
): OverheadRunInput[] {
  return OverheadRunBuilder.abba(Array.from({ length: count }, () => props));
}

describe("computeOverheadDeltas", () => {
  it("should compute treatment − base CPU, memory and main-thread deltas", () => {
    // Given
    const off = run({
      arm: "off",
      cpu: 100,
      wsBytes: 500 * MIB,
      mainThread: { longTaskBlockedMsPerSec: 1, fps: 60 },
    });
    const on = run({
      arm: "on",
      cpu: 101,
      wsBytes: 510 * MIB,
      mainThread: { longTaskBlockedMsPerSec: 3, fps: 58 },
    });

    // When
    const deltas = computeOverheadDeltas(off, on);

    // Then
    expect(deltas).toEqual({
      cpuRelative: 0.01,
      cpuPctPoints: 1,
      memBytes: 10 * MIB,
      memBytesCommonProcesses: 10 * MIB,
      mainThreadBlockedMsPerSec: 2,
      fps: -2,
    });
  });

  it("should omit the relative CPU delta for a 0 baseline and the probe deltas without a probe", () => {
    // Given
    const off = run({ arm: "off", cpu: 0 });
    const on = run({ arm: "on", cpu: 5, mainThread: { longTaskBlockedMsPerSec: 1, fps: 60 } });

    // When
    const deltas = computeOverheadDeltas(off, on);

    // Then
    expect(deltas.cpuRelative).toBeUndefined();
    expect(deltas.cpuPctPoints).toBe(5);
    expect(deltas.mainThreadBlockedMsPerSec).toBeUndefined();
    expect(deltas.fps).toBeUndefined();
  });

  it("should restrict the common-process memory delta to process types both runs had", () => {
    // Given the on run has an extra gpu process
    const off = run({ arm: "off", wsBytes: 300 * MIB, byType: { browser: 300 * MIB } });
    const on = run({
      arm: "on",
      wsBytes: 350 * MIB,
      byType: { browser: 302 * MIB, gpu: 48 * MIB },
    });

    // When
    const deltas = computeOverheadDeltas(off, on);

    // Then
    expect(deltas.memBytes).toBe(50 * MIB);
    expect(deltas.memBytesCommonProcesses).toBe(2 * MIB);
  });

  it("should omit the memory deltas when a run measured no working set", () => {
    // Given the on run's working-set collection failed (no memory poll, totals 0)
    const off = run({ arm: "off", cpu: 100, wsBytes: 500 * MIB });
    const on = run({ arm: "on", cpu: 101, wsBytes: 0, byType: {} });

    // When
    const deltas = computeOverheadDeltas(off, on);

    // Then
    expect(deltas).toEqual({ cpuRelative: 0.01, cpuPctPoints: 1 });
  });
});

describe("overheadRunFromResult", () => {
  it("should throw when the result has no steady window", () => {
    // Given
    const input = OverheadRunBuilder.input({ arm: "on" });
    delete input.result.summary.steadyWindow;

    // When / Then
    expect(() => overheadRunFromResult(input)).toThrow("no summary.steadyWindow");
  });
});

describe("buildOverheadReport", () => {
  it("should report a within verdict when the CI95 is under both targets", () => {
    // Given 6 repeats with +1 % CPU and +5 MiB
    const runs = repeats(6, { on: { cpu: 101, wsBytes: 505 * MIB } });

    // When
    const result = report(runs);

    // Then
    expect(result).toMatchObject({
      schemaVersion: 3,
      method: "relaunch",
      cpuVerdictSource: "relaunch",
      memVerdictSource: "relaunch",
      kind: "overhead",
      createdAtWall: NOW.toISOString(),
      n: 6,
      excludedPairs: 0,
      windowMismatchRuns: 0,
      verdicts: { cpu: "within", memory: "within", overall: "within" },
      targets: { cpuDeltaRelativeMax: 0.02, memDeltaBytesMax: 20 * MIB },
    });
    expect(result.runs).toHaveLength(12);
    expect(result.pairs.map((pair) => pair.order)).toEqual([
      "off-first",
      "on-first",
      "off-first",
      "on-first",
      "off-first",
      "on-first",
    ]);
    expect(result.metrics.cpuRelative.median).toBeCloseTo(0.01);
    expect(result.metrics.memBytes).toEqual({
      n: 6,
      median: 5 * MIB,
      iqr: 0,
      ci95: { lower: 5 * MIB, upper: 5 * MIB },
    });
    expect(result.withoutUaProbe).toBeUndefined();
    expect(result.uaCost).toBeUndefined();
  });

  it("should report exceeds when the memory CI95 lies above the target", () => {
    // Given
    const runs = repeats(6, { on: { wsBytes: 530 * MIB } });

    // When
    const result = report(runs);

    // Then
    expect(result.verdicts).toEqual({ cpu: "within", memory: "exceeds", overall: "exceeds" });
  });

  it("should report inconclusive when the CI95 straddles the target", () => {
    // Given memory deltas spread around the 20 MiB target
    const runs = OverheadRunBuilder.abba(
      [5, 35, 10, 30, 15, 25].map((deltaMiB) => ({ on: { wsBytes: (500 + deltaMiB) * MIB } })),
    );

    // When
    const result = report(runs);

    // Then
    expect(result.verdicts.memory).toBe("inconclusive");
    expect(result.verdicts.overall).toBe("inconclusive");
    expect(result.metrics.memBytes.ci95!.lower).toBeLessThan(20 * MIB);
    expect(result.metrics.memBytes.ci95!.upper).toBeGreaterThan(20 * MIB);
  });

  it("should report inconclusive with fewer than MIN_PAIRS_FOR_VERDICT included pairs", () => {
    // Given
    const runs = repeats(MIN_PAIRS_FOR_VERDICT - 1, {});

    // When
    const result = report(runs);

    // Then
    expect(result.n).toBe(MIN_PAIRS_FOR_VERDICT - 1);
    expect(result.verdicts.overall).toBe("inconclusive");
  });

  it("should report memory as inconclusive with n = 0 when no run measured a working set", () => {
    // Given 6 repeats whose working-set collection failed in both arms (totals 0, no types)
    const unmeasured = { wsBytes: 0, byType: {} };
    const runs = repeats(6, { off: unmeasured, on: { ...unmeasured, cpu: 101 } });

    // When
    const result = report(runs);

    // Then
    expect(result.metrics.memBytes).toEqual({ n: 0 });
    expect(result.verdicts).toEqual({
      cpu: "within",
      memory: "inconclusive",
      overall: "inconclusive",
    });
  });

  it("should exclude pairs with a window mismatch in either run", () => {
    // Given repeat 1 has a mismatched on run and repeat 2 a mismatched off run
    const runs = OverheadRunBuilder.abba([
      {},
      { on: { windowMismatch: true, wsBytes: 900 * MIB } },
      { off: { windowMismatch: true } },
      {},
      {},
    ]);

    // When
    const result = report(runs);

    // Then
    expect(result.n).toBe(3);
    expect(result.excludedPairs).toBe(2);
    expect(result.windowMismatchRuns).toBe(2);
    expect(result.pairs[1]).toMatchObject({ excluded: true, reasons: ["treatmentWindowMismatch"] });
    expect(result.pairs[2]).toMatchObject({ excluded: true, reasons: ["baseWindowMismatch"] });
    expect(result.metrics.memBytes.median).toBe(0);
  });

  it("should flag but keep pairs whose process sets differ", () => {
    // Given repeat 0's on run had an extra utility process
    const runs = OverheadRunBuilder.abba([
      { on: { processSet: { browser: 1, utility: 1 } } },
      {},
      {},
    ]);

    // When
    const result = report(runs);

    // Then
    expect(result.n).toBe(3);
    expect(result.processSetMismatches).toBe(1);
    expect(result.pairs[0]).toMatchObject({ excluded: false, flags: ["processSetMismatch"] });
    expect(result.pairs[1]!.flags).toEqual([]);
  });

  it("should cancel a run-position bias with the ABBA order", () => {
    // Given no telemetry effect but the second run of every repeat uses 10 % more CPU
    const runs = [0, 1, 2, 3].flatMap((repeat) =>
      armOrder(["off", "on"], repeat).map((arm, order) =>
        OverheadRunBuilder.input({ arm, repeat, order, cpu: order === 0 ? 100 : 110 }),
      ),
    );

    // When
    const result = report(runs);

    // Then the pair deltas alternate in sign and their median is 0
    expect(result.pairs.map((pair) => pair.deltas.cpuPctPoints)).toEqual([10, -10, 10, -10]);
    expect(result.metrics.cpuPctPoints.median).toBe(0);
  });

  it("should summarize the main-thread deltas", () => {
    // Given
    const runs = repeats(3, {
      off: { mainThread: { longTaskBlockedMsPerSec: 1, fps: 60 } },
      on: { mainThread: { longTaskBlockedMsPerSec: 4, fps: 57 } },
    });

    // When
    const result = report(runs);

    // Then
    expect(result.metrics.mainThreadBlockedMsPerSec.median).toBe(3);
    expect(result.metrics.fps.median).toBe(-3);
  });

  it("should add the UA-probe comparisons with a third arm", () => {
    // Given off, on (+10 MiB) and on-noUa (+2 MiB) in a rotating order
    const arms: OverheadArm[] = ["off", "on", "on-noUa"];
    const memMiB: Record<OverheadArm, number> = { off: 500, on: 510, "on-noUa": 502 };
    const runs = [0, 1, 2, 3, 4, 5].flatMap((repeat) =>
      armOrder(arms, repeat).map((arm, order) =>
        OverheadRunBuilder.input({ arm, repeat, order, wsBytes: memMiB[arm] * MIB }),
      ),
    );

    // When
    const result = report(runs, arms);

    // Then
    expect(result.n).toBe(6);
    expect(result.metrics.memBytes.median).toBe(10 * MIB);
    expect(result.withoutUaProbe?.metrics.memBytes.median).toBe(2 * MIB);
    expect(result.withoutUaProbe?.verdicts.overall).toBe("within");
    expect(result.uaCost?.metrics.memBytes.median).toBe(8 * MIB);
    expect(result.uaCost).not.toHaveProperty("verdicts");
    expect(result.pairs.filter((pair) => pair.comparison === "on-vs-onNoUa")).toHaveLength(6);
  });

  it("should summarize the on arm's self-cost and keep collectors states", () => {
    // Given
    const runs = repeats(3, {
      on: {
        telemetrySelf: OverheadRunBuilder.telemetrySelf({ recordsPerSec: 120 }),
        collectors: { uaMemory: "on" },
      },
      off: { collectors: { uaMemory: "disabled" } },
    });

    // When
    const result = report(runs);

    // Then
    expect(result.selfCost).toEqual({
      n: 3,
      msPerSec: 2,
      fractionOfCore: 0.00202,
      recordsPerSec: 120,
      meanEmitNs: 200,
      estimatedEmitMsPerSec: 0.02,
      uaCalls: 0,
    });
    expect(result.runs.find((entry) => entry.arm === "off")?.collectors).toEqual({
      uaMemory: "disabled",
    });
    expect(result.runs.find((entry) => entry.arm === "on")?.telemetrySelf).toBeDefined();
  });

  it("should omit the self-cost when no on run reported it", () => {
    // Given / When
    const result = report(repeats(3, {}));

    // Then
    expect(result.selfCost).toBeUndefined();
  });
});

describe("buildOverheadReport methods", () => {
  it("should take the CPU verdict from the toggle A/B and memory from the relaunch A/B (both)", () => {
    // Given relaunch runs exceeding the CPU target (+5 %) and a toggle A/B within it (+1 %)
    const runs = repeats(6, { on: { cpu: 105 } });
    const toggle = ToggleBlockBuilder.summary();

    // When
    const result = buildOverheadReport({
      platform: "electron",
      scenarioId: "sinewave",
      runs,
      config: OverheadRunBuilder.config(),
      method: "both",
      toggle,
      now: NOW,
    });

    // Then: relaunch CPU stays as informational relaunchVerdicts
    expect(result).toMatchObject({
      schemaVersion: 3,
      method: "both",
      cpuVerdictSource: "toggle",
      memVerdictSource: "relaunch",
      verdicts: { cpu: "within", memory: "within", overall: "within" },
      relaunchVerdicts: { cpu: "exceeds", memory: "within", overall: "exceeds" },
      n: 6,
    });
    expect(result.config.toggle).toEqual(toggle.config);
    expect(result.toggle).toBe(toggle);
  });

  it("should report CPU only and memory as not measured for method toggle", () => {
    // Given no relaunch runs
    const toggle = ToggleBlockBuilder.summary(
      Array.from({ length: 6 }, () => ({ off: 100, on: 105 })),
    );

    // When
    const result = buildOverheadReport({
      platform: "web",
      scenarioId: "pointcloud",
      runs: [],
      config: OverheadRunBuilder.config({ repeats: 0 }),
      method: "toggle",
      toggle,
      now: NOW,
    });

    // Then
    expect(result).toMatchObject({
      method: "toggle",
      cpuVerdictSource: "toggle",
      memVerdictSource: "notMeasured",
      verdicts: { cpu: "exceeds", overall: "exceeds" },
      n: 0,
    });
    expect(result.verdicts.memory).toBeUndefined();
    expect(result.relaunchVerdicts).toBeUndefined();
  });

  it("should add the toggle A/B without the UA probe as informational, keeping the toggle CPU verdict", () => {
    // Given a toggle A/B over the target (+5 %) and one without the UA probe within it (+1 %)
    const toggle = ToggleBlockBuilder.summary(
      Array.from({ length: 6 }, () => ({ off: 100, on: 105 })),
    );
    const toggleWithoutUaProbe = ToggleBlockBuilder.summary();

    // When
    const result = buildOverheadReport({
      platform: "web",
      scenarioId: "pointcloud",
      runs: [],
      config: OverheadRunBuilder.config({ repeats: 0 }),
      method: "toggle",
      toggle,
      toggleWithoutUaProbe,
      now: NOW,
    });

    // Then
    expect(result.toggleWithoutUaProbe).toBe(toggleWithoutUaProbe);
    expect(result.verdicts).toEqual({ cpu: "exceeds", overall: "exceeds" });
  });

  it("should add the frame-probe toggle A/B as informational, keeping the toggle CPU verdict", () => {
    // Given a toggle A/B within the target (+1 %) and a frame probe far over it (+7 %)
    const toggleFrameProbe = ToggleBlockBuilder.summary(
      Array.from({ length: 6 }, () => ({ off: 100, on: 107 })),
    );

    // When
    const result = buildOverheadReport({
      platform: "electron",
      scenarioId: "mcap-multi-ingest",
      runs: [],
      config: OverheadRunBuilder.config({ repeats: 0 }),
      method: "toggle",
      toggle: ToggleBlockBuilder.summary(),
      toggleFrameProbe,
      now: NOW,
    });

    // Then
    expect(result.toggleFrameProbe).toBe(toggleFrameProbe);
    expect(result.verdicts).toEqual({ cpu: "within", overall: "within" });
  });

  it("should drop a frame-probe toggle A/B when the toggle A/B did not run", () => {
    // Given method relaunch with a stray frame-probe section
    const runs = repeats(5, {});

    // When
    const result = buildOverheadReport({
      platform: "electron",
      scenarioId: "mcap-multi-ingest",
      runs,
      config: OverheadRunBuilder.config(),
      method: "relaunch",
      toggleFrameProbe: ToggleBlockBuilder.summary(),
      now: NOW,
    });

    // Then
    expect(result.toggleFrameProbe).toBeUndefined();
  });

  it("should add the direct attribution with its own verdict, never merged into the verdicts", () => {
    // Given a toggle A/B within the target and a direct attribution exceeding it
    const directAttribution = CpuProfileBuilder.measured({ relative: 0.03, verdict: "exceeds" });

    // When
    const result = buildOverheadReport({
      platform: "web",
      scenarioId: "pointcloud",
      runs: [],
      config: OverheadRunBuilder.config({ repeats: 0 }),
      method: "toggle",
      toggle: ToggleBlockBuilder.summary(),
      directAttribution,
      now: NOW,
    });

    // Then
    expect(result.directAttribution).toBe(directAttribution);
    expect(result.verdicts).toEqual({ cpu: "within", overall: "within" });
  });

  it("should drop a direct attribution when the toggle A/B did not run", () => {
    // Given method relaunch with a stray direct attribution
    const runs = repeats(5, {});

    // When
    const result = buildOverheadReport({
      platform: "web",
      scenarioId: "pointcloud",
      runs,
      config: OverheadRunBuilder.config(),
      method: "relaunch",
      directAttribution: CpuProfileBuilder.measured(),
      now: NOW,
    });

    // Then
    expect(result.directAttribution).toBeUndefined();
  });

  it("should drop a toggle A/B without the UA probe when the toggle A/B did not run", () => {
    // Given method relaunch with a stray toggle section without the probe
    const runs = repeats(5, {});

    // When
    const result = buildOverheadReport({
      platform: "web",
      scenarioId: "pointcloud",
      runs,
      config: OverheadRunBuilder.config(),
      method: "relaunch",
      toggleWithoutUaProbe: ToggleBlockBuilder.summary(),
      now: NOW,
    });

    // Then
    expect(result.toggleWithoutUaProbe).toBeUndefined();
  });
});

describe("overheadFinalVerdicts", () => {
  const relaunchVerdicts = {
    cpu: "inconclusive",
    memory: "exceeds",
    overall: "exceeds",
  } as const;

  it("should keep the relaunch verdicts for method relaunch", () => {
    // Given / When
    const result = overheadFinalVerdicts({
      method: "relaunch",
      relaunchVerdicts,
      toggle: undefined,
    });

    // Then
    expect(result).toEqual({
      verdicts: relaunchVerdicts,
      cpuVerdictSource: "relaunch",
      memVerdictSource: "relaunch",
    });
  });

  it("should combine the toggle CPU with the relaunch memory, worst overall (both)", () => {
    // Given / When
    const result = overheadFinalVerdicts({
      method: "both",
      relaunchVerdicts,
      toggle: { verdict: "within" },
    });

    // Then
    expect(result.verdicts).toEqual({ cpu: "within", memory: "exceeds", overall: "exceeds" });
  });

  it.each([
    "toggle",
    "both",
  ] as const)("should throw for method %s without a toggle summary", (method) => {
    // Given / When / Then
    expect(() => overheadFinalVerdicts({ method, relaunchVerdicts, toggle: undefined })).toThrow(
      `Overhead method ${method} needs the toggle A/B summary`,
    );
  });
});

describe("overheadFileName", () => {
  it("should name the report by platform, scenario and timestamp", () => {
    // Given / When / Then
    expect(overheadFileName("web", "pointcloud", 42)).toBe("overhead-web-pointcloud-42.json");
  });
});
