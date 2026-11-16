// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ToggleBlockBuilder } from "./builders/ToggleBlockBuilder";
import {
  BLOCKS_PER_QUARTET,
  blockCpu,
  buildToggleBlocks,
  buildTogglePairs,
  buildToggleQuartets,
  modalProcessSet,
  processSetKey,
  recordsByRealmIn,
  summarizeToggle,
  toggleBlockArms,
  toggleOffCpuPercent,
  toggleProcessTypeDeltas,
  toggleScenarioDurationMs,
} from "./toggleBlocks";
import { MIN_QUARTETS_FOR_VERDICT } from "../result/constants";

const TARGET = 0.02;

describe("toggleBlockArms", () => {
  it("should schedule every quartet as off, on, on, off", () => {
    // Given / When
    const arms = toggleBlockArms(2);

    // Then
    expect(arms).toEqual(["off", "on", "on", "off", "off", "on", "on", "off"]);
  });

  it.each([4, 7, 10])("should schedule %p complete quartets", (quartets) => {
    // Given / When
    const arms = toggleBlockArms(quartets);

    // Then: 4 blocks per quartet, two of each arm in mirrored order
    expect(arms).toHaveLength(quartets * BLOCKS_PER_QUARTET);
    const { blocks } = buildToggleBlocks(ToggleBlockBuilder.fromBlockCpu(arms.map(() => 100)), []);
    expect(buildToggleQuartets(blocks)).toHaveLength(quartets);
  });
});

describe("blockCpu", () => {
  it("should divide the summed cumulative CPU delta by the wall time (per-core sum)", () => {
    // Given 3 processes each using 0.5 CPU s over 2.5 s
    const start = ToggleBlockBuilder.readings(10);
    const end = ToggleBlockBuilder.readings(10.5);

    // When
    const cpu = blockCpu(start, end, 2500);

    // Then: 1.5 CPU s / 2.5 s = 60 % of one core
    expect(cpu.cpuPercent).toBeCloseTo(60, 10);
    expect(cpu.processSet).toEqual({ browser: 1, gpu: 1, renderer: 1 });
    expect(cpu.processSetChanged).toBe(false);
  });

  it("should exceed 100 % when more than one core is busy", () => {
    // Given 3 processes each using 2 CPU s over 2 s
    const start = ToggleBlockBuilder.readings(1);
    const end = ToggleBlockBuilder.readings(3);

    // When / Then
    expect(blockCpu(start, end, 2000).cpuPercent).toBeCloseTo(300, 10);
  });

  it("should count only processes present at both reads and flag the change", () => {
    // Given a utility process that appears and a renderer that exits during the block
    const start = [
      { pid: 1, processType: "browser", cpuTimeSec: 1 },
      { pid: 2, processType: "renderer", cpuTimeSec: 5 },
    ];
    const end = [
      { pid: 1, processType: "browser", cpuTimeSec: 2 },
      { pid: 3, processType: "utility", cpuTimeSec: 9 },
    ];

    // When
    const cpu = blockCpu(start, end, 1000);

    // Then: only the browser's 1 CPU s over 1 s
    expect(cpu.cpuPercent).toBeCloseTo(100, 10);
    expect(cpu.processSet).toEqual({ browser: 1 });
    expect(cpu.processSetChanged).toBe(true);
  });

  it("should split the block CPU by process type", () => {
    // Given two renderers and a GPU process
    const start = [
      { pid: 1, processType: "renderer", cpuTimeSec: 1 },
      { pid: 2, processType: "renderer", cpuTimeSec: 1 },
      { pid: 3, processType: "gpu", cpuTimeSec: 1 },
    ];
    const end = [
      { pid: 1, processType: "renderer", cpuTimeSec: 1.5 },
      { pid: 2, processType: "renderer", cpuTimeSec: 1.25 },
      { pid: 3, processType: "gpu", cpuTimeSec: 1.5 },
    ];

    // When
    const cpu = blockCpu(start, end, 1000);

    // Then: the per-type values sum to the block CPU
    expect(cpu.cpuPercentByProcessType).toEqual({ renderer: 75, gpu: 50 });
    expect(cpu.cpuPercent).toBeCloseTo(125, 10);
  });

  it("should clamp a negative per-process delta to 0", () => {
    // Given a pid whose cumulative CPU went backwards (reused pid)
    const start = [{ pid: 1, processType: "renderer", cpuTimeSec: 5 }];
    const end = [{ pid: 1, processType: "renderer", cpuTimeSec: 1 }];

    // When / Then
    expect(blockCpu(start, end, 1000).cpuPercent).toBe(0);
  });

  it.each([0, -5, Number.NaN])("should throw for a wall time of %p ms", (wallMs) => {
    // Given
    const readings = ToggleBlockBuilder.readings(1);

    // When / Then
    expect(() => blockCpu(readings, readings, wallMs)).toThrow(
      "Toggle block wall time must be positive",
    );
  });
});

describe("processSetKey / modalProcessSet", () => {
  it("should key a process set independently of the property order", () => {
    // Given / When / Then
    expect(processSetKey({ renderer: 2, browser: 1 })).toBe("browser:1,renderer:2");
    expect(processSetKey({ browser: 1, renderer: 2 })).toBe("browser:1,renderer:2");
  });

  it("should pick the most frequent set, the earliest on ties", () => {
    // Given
    const a = { browser: 1, renderer: 1 };
    const b = { browser: 1, renderer: 2 };

    // When / Then
    expect(modalProcessSet([a, b, b])).toEqual(b);
    expect(modalProcessSet([b, a])).toEqual(b);
    expect(modalProcessSet([])).toEqual({});
  });
});

describe("recordsByRealmIn", () => {
  it("should count records per realm inside the inclusive bounds", () => {
    // Given
    const records = [
      { realm: "renderer", monotonicTs: 99 },
      { realm: "renderer", monotonicTs: 100 },
      { realm: "worker", monotonicTs: 150 },
      { realm: "renderer", monotonicTs: 200 },
      { realm: "renderer", monotonicTs: 201 },
    ];

    // When / Then
    expect(recordsByRealmIn(records, 100, 200)).toEqual({ renderer: 2, worker: 1 });
  });
});

describe("buildToggleBlocks", () => {
  it("should flag blocks whose process set changed or differs from the modal set", () => {
    // Given 4 blocks: one with an extra renderer, one with a process change
    const recordings = ToggleBlockBuilder.abba([{ off: 100, on: 101 }], (index) => {
      if (index === 1) {
        return { processSet: { browser: 1, gpu: 1, renderer: 2 } };
      }
      return index === 3 ? { processSetChanged: true } : {};
    });

    // When
    const { blocks, modalProcessSet: modal } = buildToggleBlocks(recordings, []);

    // Then
    expect(modal).toEqual({ browser: 1, gpu: 1, renderer: 1 });
    expect(blocks.map((block) => block.flags)).toEqual([
      [],
      ["processSetNotModal"],
      [],
      ["processSetChanged"],
    ]);
  });

  it("should attach the records stamped inside each block's measured part", () => {
    // Given 2 blocks, measured [1500, 4000] and [4500, 7000], with records in the second only
    const recordings = ToggleBlockBuilder.abba([{ off: 100, on: 101 }]);
    const records = [
      { realm: "renderer", monotonicTs: 4200 },
      { realm: "renderer", monotonicTs: 5000 },
      { realm: "worker", monotonicTs: 6000 },
    ];

    // When
    const { blocks } = buildToggleBlocks(recordings, records);

    // Then: the record in the settle period (4200) is not counted
    expect(blocks[0]!.recordsByRealm).toEqual({});
    expect(blocks[1]!.recordsByRealm).toEqual({ renderer: 1, worker: 1 });
  });
});

describe("buildTogglePairs", () => {
  it("should pair adjacent blocks with on − off deltas in both orders", () => {
    // Given an off-first pair (100 → 102) and an on-first pair (198 / 200)
    const { blocks } = buildToggleBlocks(ToggleBlockBuilder.fromBlockCpu([100, 102, 198, 200]), []);

    // When
    const pairs = buildTogglePairs(blocks);

    // Then
    expect(pairs).toEqual([
      {
        index: 0,
        order: "off-first",
        offBlock: 0,
        onBlock: 1,
        cpuRelative: 0.02,
        cpuPctPoints: 2,
        excluded: false,
        reasons: [],
      },
      {
        index: 1,
        order: "on-first",
        offBlock: 3,
        onBlock: 2,
        cpuRelative: -0.01,
        cpuPctPoints: -2,
        excluded: false,
        reasons: [],
      },
    ]);
  });

  it("should exclude a pair with a flagged block and name the flagged arm", () => {
    // Given the second pair's on block (index 2) has a process change
    const { blocks } = buildToggleBlocks(
      ToggleBlockBuilder.abba([{ off: 100, on: 101 }], (index) =>
        index === 2 ? { processSetChanged: true } : {},
      ),
      [],
    );

    // When
    const pairs = buildTogglePairs(blocks);

    // Then
    expect(pairs.map((pair) => pair.excluded)).toEqual([false, true]);
    expect(pairs[1]!.reasons).toEqual(["onBlockFlagged"]);
  });

  it("should omit the relative delta for a 0 baseline and skip a trailing block", () => {
    // Given a pair with an idle off block and a trailing unpaired block
    const { blocks } = buildToggleBlocks(ToggleBlockBuilder.fromBlockCpu([0, 1, 1]), []);

    // When
    const pairs = buildTogglePairs(blocks);

    // Then
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.cpuRelative).toBeUndefined();
    expect(pairs[0]!.cpuPctPoints).toBe(1);
  });
});

describe("buildToggleQuartets", () => {
  it("should compare the summed CPU of both blocks per arm", () => {
    // Given off blocks 100 and 104, on blocks 103 and 105
    const { blocks } = buildToggleBlocks(ToggleBlockBuilder.fromBlockCpu([100, 103, 105, 104]), []);

    // When
    const quartets = buildToggleQuartets(blocks);

    // Then: 208 / 204 − 1 and (104 − 102) pp
    expect(quartets).toEqual([
      {
        index: 0,
        order: "off-on-on-off",
        offBlocks: [0, 3],
        onBlocks: [1, 2],
        offCpuPercent: 102,
        onCpuPercent: 104,
        cpuRelative: expect.closeTo(208 / 204 - 1, 12),
        cpuPctPoints: 2,
        excluded: false,
        reasons: [],
      },
    ]);
  });

  it("should cancel a linear drift to a 0 delta where the adjacent pairs alternate in sign", () => {
    // Given 3 quartets, no overhead, CPU falling 2 pp per block
    const { blocks } = buildToggleBlocks(
      ToggleBlockBuilder.fromBlockCpu(Array.from({ length: 12 }, (_, index) => 60 - 2 * index)),
      [],
    );

    // When
    const quartets = buildToggleQuartets(blocks);
    const pairs = buildTogglePairs(blocks);

    // Then
    for (const quartet of quartets) {
      expect(quartet.cpuRelative).toBeCloseTo(0, 12);
      expect(quartet.cpuPctPoints).toBeCloseTo(0, 12);
    }
    expect(pairs.map((pair) => Math.sign(pair.cpuPctPoints))).toEqual([-1, 1, -1, 1, -1, 1]);
  });

  it("should recover a relative overhead exactly under a linear drift", () => {
    // Given +1 % overhead on a CPU rising 3 pp per block
    const { blocks } = buildToggleBlocks(
      ToggleBlockBuilder.fromBlockCpu(
        toggleBlockArms(2).map((arm, index) => (100 + 3 * index) * (arm === "on" ? 1.01 : 1)),
      ),
      [],
    );

    // When
    const quartets = buildToggleQuartets(blocks);

    // Then
    expect(quartets.map((quartet) => quartet.cpuRelative)).toEqual([
      expect.closeTo(0.01, 12),
      expect.closeTo(0.01, 12),
    ]);
  });

  it("should weight each block's CPU by its measured wall time", () => {
    // Given off blocks of 100 % over 1 s and 200 % over 3 s; on blocks at 150 %
    const { blocks } = buildToggleBlocks(
      ToggleBlockBuilder.fromBlockCpu([100, 150, 150, 200], (index) => ({
        measuredMs: index === 0 ? 1000 : 3000,
      })),
      [],
    );

    // When
    const [quartet] = buildToggleQuartets(blocks);

    // Then: off = (1 + 6) CPU s / 4 s = 175 %
    expect(quartet!.offCpuPercent).toBeCloseTo(175, 12);
    expect(quartet!.cpuRelative).toBeCloseTo(150 / 175 - 1, 12);
  });

  it("should accept the mirrored on-off-off-on order", () => {
    // Given
    const recordings = (["on", "off", "off", "on"] as const).map((arm, index) =>
      ToggleBlockBuilder.recording({ index, arm, cpuPercent: arm === "on" ? 102 : 100 }),
    );
    const { blocks } = buildToggleBlocks(recordings, []);

    // When
    const quartets = buildToggleQuartets(blocks);

    // Then
    expect(quartets).toMatchObject([
      { order: "on-off-off-on", offBlocks: [1, 2], onBlocks: [0, 3], cpuRelative: 0.02 },
    ]);
  });

  it("should exclude a quartet with any flagged block and name the flagged arms", () => {
    // Given 3 quartets: an off block of the first and both arms of the third flagged
    const { blocks } = buildToggleBlocks(
      ToggleBlockBuilder.abba(
        Array.from({ length: 3 }, () => ({ off: 100, on: 101 })),
        (index) => ([3, 9, 11].includes(index) ? { processSetChanged: true } : {}),
      ),
      [],
    );

    // When
    const quartets = buildToggleQuartets(blocks);

    // Then
    expect(quartets.map(({ excluded, reasons }) => ({ excluded, reasons }))).toEqual([
      { excluded: true, reasons: ["offBlockFlagged"] },
      { excluded: false, reasons: [] },
      { excluded: true, reasons: ["offBlockFlagged", "onBlockFlagged"] },
    ]);
  });

  it("should skip an incomplete trailing quartet", () => {
    // Given one quartet plus 3 blocks
    const { blocks } = buildToggleBlocks(
      ToggleBlockBuilder.fromBlockCpu([1, 2, 2, 1, 1, 2, 2]),
      [],
    );

    // When / Then
    expect(buildToggleQuartets(blocks)).toHaveLength(1);
  });

  it("should skip 4 blocks not in mirrored order", () => {
    // Given off, on, off, on
    const recordings = (["off", "on", "off", "on"] as const).map((arm, index) =>
      ToggleBlockBuilder.recording({ index, arm }),
    );
    const { blocks } = buildToggleBlocks(recordings, []);

    // When / Then
    expect(buildToggleQuartets(blocks)).toEqual([]);
  });

  it("should omit the relative delta for an idle off arm", () => {
    // Given
    const { blocks } = buildToggleBlocks(ToggleBlockBuilder.fromBlockCpu([0, 1, 1, 0]), []);

    // When
    const [quartet] = buildToggleQuartets(blocks);

    // Then
    expect(quartet!.cpuRelative).toBeUndefined();
    expect(quartet!.cpuPctPoints).toBe(1);
  });
});

describe("summarizeToggle", () => {
  it("should report within when the CI95 of the relative delta is under the target", () => {
    // Given 6 quartets at +0.5 % to +1 %
    const recordings = ToggleBlockBuilder.abba(
      [0.5, 1, 0.8, 0.6, 0.9, 0.7].map((delta) => ({ off: 100, on: 100 + delta })),
    );

    // When
    const summary = summarizeToggle({
      recordings,
      records: [],
      config: ToggleBlockBuilder.config({ quartets: 6 }),
      cpuDeltaRelativeMax: TARGET,
      runDurationMs: 60_000,
    });

    // Then
    expect(summary).toMatchObject({
      method: "toggle",
      n: 6,
      excludedQuartets: 0,
      verdict: "within",
      flaggedBlocks: 0,
      runDurationMs: 60_000,
    });
    expect(summary.metrics.cpuRelative.median).toBeCloseTo(0.0075, 10);
    expect(summary.metrics.cpuRelative.iqr).toBeGreaterThan(0);
    expect(summary.metrics.cpuRelative.ci95!.upper).toBeLessThanOrEqual(TARGET);
    expect(summary.metrics.cpuPctPoints.median).toBeCloseTo(0.75, 10);
  });

  it("should report exceeds when the whole CI95 lies above the target", () => {
    // Given 6 quartets at +5 %
    const summary = ToggleBlockBuilder.summary(
      Array.from({ length: 6 }, () => ({ off: 100, on: 105 })),
    );

    // When / Then
    expect(summary.verdict).toBe("exceeds");
  });

  it("should be inconclusive with fewer than MIN_QUARTETS_FOR_VERDICT included quartets", () => {
    // Given 8 quartets, 3 of them with a process change in their first block
    const recordings = ToggleBlockBuilder.abba(
      Array.from({ length: 8 }, () => ({ off: 100, on: 100.1 })),
      (index) => (index < 12 && index % 4 === 0 ? { processSetChanged: true } : {}),
    );

    // When
    const summary = summarizeToggle({
      recordings,
      records: [],
      config: ToggleBlockBuilder.config(),
      cpuDeltaRelativeMax: TARGET,
    });

    // Then: 5 included quartets, all far within the target, have no 95 % interval and no verdict
    expect(summary.n).toBe(MIN_QUARTETS_FOR_VERDICT - 1);
    expect(summary.excludedQuartets).toBe(3);
    expect(summary.flaggedBlocks).toBe(3);
    expect(summary.metrics.cpuRelative.median).toBeLessThan(TARGET);
    expect(summary.metrics.cpuRelative.ci95).toBeUndefined();
    expect(summary.verdict).toBe("inconclusive");
  });

  it("should give a verdict from MIN_QUARTETS_FOR_VERDICT included quartets on", () => {
    // Given exactly 6 quartets at +0.1 %
    const summary = ToggleBlockBuilder.summary(
      Array.from({ length: MIN_QUARTETS_FOR_VERDICT }, () => ({ off: 100, on: 100.1 })),
    );

    // When / Then
    expect(summary.n).toBe(MIN_QUARTETS_FOR_VERDICT);
    expect(summary.verdict).toBe("within");
  });

  it("should total toggle latency, late starts, UA calls and renderer records per arm", () => {
    // Given 1 quartet; renderer records only in on blocks; UA calls in one on block
    const recordings = ToggleBlockBuilder.abba([{ off: 100, on: 101 }], (index) => ({
      toggleLatencyMs: [4, 12, 7, 3][index],
      lateStart: index === 1,
      uaCalls: index === 2 ? 1 : 0,
    }));
    const onBlockTs = recordings
      .filter((block) => block.arm === "on")
      .map((block) => block.startMonotonicTs + 1);
    const records = [
      ...onBlockTs.map((monotonicTs) => ({ realm: "renderer", monotonicTs })),
      { realm: "worker", monotonicTs: recordings[0]!.startMonotonicTs + 1 },
    ];

    // When
    const summary = summarizeToggle({
      recordings,
      records,
      config: ToggleBlockBuilder.config({ quartets: 1 }),
      cpuDeltaRelativeMax: TARGET,
    });

    // Then
    expect(summary.toggleLatencyMsMax).toBe(12);
    expect(summary.lateStartBlocks).toBe(1);
    expect(summary.uaCalls).toEqual({ onBlocks: 1, offBlocks: 0 });
    expect(summary.rendererRecords).toEqual({ onBlocks: 2, offBlocks: 0 });
    expect(summary.runDurationMs).toBeUndefined();
  });
});

describe("summarizeToggle (drift)", () => {
  it("should give a verdict from quartets where drifting pairs stay inconclusive", () => {
    // Given 6 quartets, +0.5 % overhead on a CPU falling 1.5 % of its start per block
    const recordings = ToggleBlockBuilder.fromBlockCpu(
      toggleBlockArms(6).map((arm, index) => (200 - 3 * index) * (arm === "on" ? 1.005 : 1)),
    );

    // When
    const summary = summarizeToggle({
      recordings,
      records: [],
      config: ToggleBlockBuilder.config(),
      cpuDeltaRelativeMax: TARGET,
    });

    // Then: every quartet at +0.5 %, while the pair deltas swing by ±1.5 %
    expect(summary.metrics.cpuRelative.ci95!.upper).toBeCloseTo(0.005, 12);
    expect(summary.verdict).toBe("within");
    expect(Math.max(...summary.pairs.map((pair) => pair.cpuRelative!))).toBeGreaterThan(TARGET);
  });

  it("should keep the adjacent pairs and their exclusion as a diagnostic", () => {
    // Given 2 quartets with a flagged on block in the second
    const summary = summarizeToggle({
      recordings: ToggleBlockBuilder.abba(
        [
          { off: 100, on: 101 },
          { off: 100, on: 101 },
        ],
        (index) => (index === 5 ? { processSetChanged: true } : {}),
      ),
      records: [],
      config: ToggleBlockBuilder.config({ quartets: 2 }),
      cpuDeltaRelativeMax: TARGET,
    });

    // When
    const excludedPairs = summary.pairs.filter((pair) => pair.excluded).map((pair) => pair.index);

    // Then
    expect(summary.quartets.map((quartet) => quartet.excluded)).toEqual([false, true]);
    expect(excludedPairs).toEqual([2]);
  });
});

describe("toggleScenarioDurationMs", () => {
  it("should cover the warm-up, every block and the margin", () => {
    // Given / When / Then: 10 s + 40 × 3 s + 2 s
    expect(
      toggleScenarioDurationMs({ warmupMs: 10_000, blocks: 40, blockMs: 3000, marginMs: 2000 }),
    ).toBe(132_000);
  });

  it("should add the profiled period after the blocks", () => {
    // Given / When / Then: 10 s + 16 × 3 s + 10 s + 2 s
    expect(
      toggleScenarioDurationMs({
        warmupMs: 10_000,
        blocks: 16,
        blockMs: 3000,
        profileMs: 10_000,
        marginMs: 2000,
      }),
    ).toBe(70_000);
  });
});

describe("toggleOffCpuPercent", () => {
  it("should average the off-arm CPU of the included quartets", () => {
    // Given 3 quartets with off CPU 20, 40 and 90 %, the last one excluded
    const summary = ToggleBlockBuilder.summary([
      { off: 20, on: 21 },
      { off: 40, on: 41 },
      { off: 90, on: 91 },
    ]);
    const quartets = summary.quartets.map((quartet, index) => ({
      ...quartet,
      excluded: index === 2,
    }));

    // When
    const offCpuPercent = toggleOffCpuPercent(quartets);

    // Then
    expect(offCpuPercent).toBeCloseTo(30, 9);
  });

  it("should be undefined without an included quartet", () => {
    // Given / When / Then
    expect(toggleOffCpuPercent([{ offCpuPercent: 30, excluded: true }])).toBeUndefined();
  });
});

describe("toggleProcessTypeDeltas", () => {
  /** Summary of 3 quartets; per block the GPU / renderer CPU from `split(arm, quartet)`. */
  function summaryWithSplit(
    split: (arm: "off" | "on", quartet: number) => Record<string, number>,
  ): ReturnType<typeof summarizeToggle> {
    const arms = toggleBlockArms(3);
    return summarizeToggle({
      recordings: ToggleBlockBuilder.abba(
        Array.from({ length: 3 }, () => ({ off: 100, on: 101 })),
        (index) => ({
          cpuPercentByProcessType: split(arms[index]!, Math.floor(index / BLOCKS_PER_QUARTET)),
        }),
      ),
      records: [],
      config: ToggleBlockBuilder.config({ quartets: 3 }),
      cpuDeltaRelativeMax: TARGET,
    });
  }

  it("should average the on − off pp per process type over the included quartets, largest first", () => {
    // Given: GPU +1 pp in every quartet, renderer −0.5 / +0.5 / −2.5 pp, last quartet excluded
    const summary = summaryWithSplit((arm, quartet) => ({
      renderer: arm === "on" ? [49.5, 50.5, 47.5][quartet]! : 50,
      gpu: arm === "on" ? 11 : 10,
    }));
    const toggle = {
      ...summary,
      quartets: summary.quartets.map((quartet) => ({ ...quartet, excluded: quartet.index === 2 })),
    };

    // When
    const deltas = toggleProcessTypeDeltas(toggle);

    // Then
    expect(deltas).toEqual([
      { processType: "gpu", meanPctPoints: 1, positiveQuartets: 2, quartets: 2 },
      { processType: "renderer", meanPctPoints: 0, positiveQuartets: 1, quartets: 2 },
    ]);
  });

  it("should count a process type missing in a block as 0", () => {
    // Given: a utility process only in the on blocks (2 %)
    const summary = summaryWithSplit(
      (arm): Record<string, number> =>
        arm === "on" ? { renderer: 50, utility: 2 } : { renderer: 50 },
    );

    // When
    const deltas = toggleProcessTypeDeltas(summary);

    // Then
    expect(deltas[0]).toEqual({
      processType: "utility",
      meanPctPoints: 2,
      positiveQuartets: 3,
      quartets: 3,
    });
  });

  it("should ignore a process type seen only in excluded quartets", () => {
    // Given: a utility process only in the last quartet's blocks, which is excluded
    const summary = summaryWithSplit(
      (_arm, quartet): Record<string, number> =>
        quartet === 2 ? { renderer: 50, utility: 2 } : { renderer: 50 },
    );
    const toggle = {
      ...summary,
      quartets: summary.quartets.map((quartet) => ({ ...quartet, excluded: quartet.index === 2 })),
    };

    // When
    const deltas = toggleProcessTypeDeltas(toggle);

    // Then
    expect(deltas.map((delta) => delta.processType)).toEqual(["renderer"]);
  });

  it("should be empty for blocks without the per-type split or without an included quartet", () => {
    // Given
    const summary = summaryWithSplit(() => ({ renderer: 50 }));
    const legacy = {
      ...summary,
      blocks: summary.blocks.map(({ cpuPercentByProcessType: _split, ...block }) => block),
    };
    const allExcluded = {
      ...summary,
      quartets: summary.quartets.map((quartet) => ({ ...quartet, excluded: true })),
    };

    // When / Then
    expect(toggleProcessTypeDeltas(legacy)).toEqual([]);
    expect(toggleProcessTypeDeltas(allExcluded)).toEqual([]);
  });
});
