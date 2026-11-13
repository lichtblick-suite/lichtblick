// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { OVERHEAD_RUN_SETUP_BUDGET_MS, OVERHEAD_TIMEOUT_BASE_MS } from "./constants";
import { overheadToggleAutoPauseMs } from "./overheadFixtures";
import {
  armOrder,
  armRunOptions,
  buildOverheadSchedule,
  overheadArms,
  overheadTestTimeoutMs,
  parseOverheadConfig,
  parseOverheadMethod,
  runsRelaunch,
  runsToggle,
  runsToggleFrameProbe,
  toggleUaProbeVariants,
} from "./overheadSchedule";

describe("parseOverheadMethod", () => {
  it("should default to both for a missing or blank value", () => {
    // Given / When / Then
    expect(parseOverheadMethod(undefined)).toBe("both");
    expect(parseOverheadMethod(" ")).toBe("both");
  });

  it("should read the methods case-insensitively", () => {
    // Given / When / Then
    expect(parseOverheadMethod("toggle")).toBe("toggle");
    expect(parseOverheadMethod(" Relaunch ")).toBe("relaunch");
    expect(parseOverheadMethod("BOTH")).toBe("both");
  });

  it("should throw for an unknown method", () => {
    // Given / When / Then
    expect(() => parseOverheadMethod("inprocess")).toThrow(
      "BENCHMARK_OVERHEAD_METHOD=inprocess is not one of toggle, relaunch, both",
    );
  });
});

describe("runsToggle / runsRelaunch", () => {
  it("should run the toggle A/B for toggle and both, the relaunch A/B for relaunch and both", () => {
    // Given / When / Then
    expect([runsToggle("toggle"), runsToggle("relaunch"), runsToggle("both")]).toEqual([
      true,
      false,
      true,
    ]);
    expect([runsRelaunch("toggle"), runsRelaunch("relaunch"), runsRelaunch("both")]).toEqual([
      false,
      true,
      true,
    ]);
  });
});

describe("parseOverheadConfig", () => {
  it("should default to both methods, 8 repeats, 1 warm-up run, 10 × 4 × 3 s toggle blocks", () => {
    // Given / When
    const config = parseOverheadConfig({}, "web");

    // Then
    expect(config).toEqual({
      method: "both",
      repeats: 8,
      warmupRuns: 1,
      polls: 10,
      uaArm: false,
      gate: false,
      toggleQuartets: 10,
      toggleBlockMs: 3000,
      profileMs: 10_000,
      frameProbeArm: false,
    });
  });

  it("should read the env knobs and clamp them to their minimums", () => {
    // Given
    const env = {
      BENCHMARK_OVERHEAD_REPEATS: "0",
      BENCHMARK_OVERHEAD_WARMUP_RUNS: "0",
      BENCHMARK_OVERHEAD_POLLS: "3",
      BENCHMARK_OVERHEAD_UA_ARM: "1",
      BENCHMARK_OVERHEAD_GATE: "1",
      BENCHMARK_OVERHEAD_METHOD: "toggle",
      BENCHMARK_OVERHEAD_TOGGLE_QUARTETS: "2",
      BENCHMARK_OVERHEAD_TOGGLE_BLOCK_MS: "200",
      BENCHMARK_OVERHEAD_PROFILE_MS: "0",
      BENCHMARK_OVERHEAD_FRAME_PROBE_ARM: "1",
    };

    // When
    const config = parseOverheadConfig(env, "web");

    // Then
    expect(config).toEqual({
      method: "toggle",
      repeats: 1,
      warmupRuns: 0,
      polls: 5,
      uaArm: true,
      gate: true,
      toggleQuartets: 4,
      toggleBlockMs: 1000,
      profileMs: 0,
      frameProbeArm: true,
    });
  });

  it("should read the toggle quartets and block length", () => {
    // Given
    const env = {
      BENCHMARK_OVERHEAD_TOGGLE_QUARTETS: "7",
      BENCHMARK_OVERHEAD_TOGGLE_BLOCK_MS: "5000",
    };

    // When
    const config = parseOverheadConfig(env, "electron");

    // Then
    expect(config.toggleQuartets).toBe(7);
    expect(config.toggleBlockMs).toBe(5000);
  });

  it.each([
    "4.5",
    "ten",
    "1o",
    "-3",
    "1e1",
    "0x10",
  ])("should throw for the toggle quartets %p, naming the variable", (toggleQuartets) => {
    // Given
    const env = { BENCHMARK_OVERHEAD_TOGGLE_QUARTETS: toggleQuartets };

    // When
    const parse = () => parseOverheadConfig(env, "web");

    // Then
    expect(parse).toThrow(
      `BENCHMARK_OVERHEAD_TOGGLE_QUARTETS=${toggleQuartets} is not a non-negative integer`,
    );
  });

  it("should accept a count with surrounding whitespace", () => {
    // Given
    const env = { BENCHMARK_OVERHEAD_TOGGLE_QUARTETS: " 6 " };

    // When
    const config = parseOverheadConfig(env, "web");

    // Then
    expect(config.toggleQuartets).toBe(6);
  });

  it.each([
    { value: "0", expected: 0 },
    { value: "5000", expected: 5000 },
    { value: "", expected: 10_000 },
  ])("should read the profiled period $value as $expected ms", ({ value, expected }) => {
    // Given
    const env = { BENCHMARK_OVERHEAD_PROFILE_MS: value };

    // When
    const config = parseOverheadConfig(env, "electron");

    // Then
    expect(config.profileMs).toBe(expected);
  });

  it("should fall back to the defaults for blank values", () => {
    // Given
    const env = {
      BENCHMARK_OVERHEAD_REPEATS: "",
      BENCHMARK_OVERHEAD_WARMUP_RUNS: " ",
      BENCHMARK_OVERHEAD_POLLS: "\t",
      BENCHMARK_OVERHEAD_TOGGLE_QUARTETS: " ",
      BENCHMARK_OVERHEAD_TOGGLE_BLOCK_MS: "",
    };

    // When
    const config = parseOverheadConfig(env, "electron");

    // Then
    expect(config.repeats).toBe(8);
    expect(config.warmupRuns).toBe(1);
    expect(config.polls).toBe(10);
    expect(config.toggleQuartets).toBe(10);
    expect(config.toggleBlockMs).toBe(3000);
  });

  it.each([
    { name: "BENCHMARK_OVERHEAD_REPEATS", value: "2.5" },
    { name: "BENCHMARK_OVERHEAD_WARMUP_RUNS", value: "-2" },
    { name: "BENCHMARK_OVERHEAD_POLLS", value: "many" },
    { name: "BENCHMARK_OVERHEAD_TOGGLE_BLOCK_MS", value: "3s" },
    { name: "BENCHMARK_OVERHEAD_PROFILE_MS", value: "1.5" },
  ])("should throw for $name=$value instead of using the default", ({ name, value }) => {
    // Given
    const env = { [name]: value };

    // When
    const parse = () => parseOverheadConfig(env, "electron");

    // Then
    expect(parse).toThrow(`${name}=${value} is not a non-negative integer`);
  });

  it("should read the steady poll count", () => {
    // Given / When
    const config = parseOverheadConfig({ BENCHMARK_OVERHEAD_POLLS: "20" }, "electron");

    // Then
    expect(config.polls).toBe(20);
  });

  it("should ignore the UA arm on Electron", () => {
    // Given / When
    const config = parseOverheadConfig({ BENCHMARK_OVERHEAD_UA_ARM: "1" }, "electron");

    // Then
    expect(config.uaArm).toBe(false);
  });
});

describe("runsToggleFrameProbe", () => {
  it("should run the frame-probe launch only with the arm and a method including toggle", () => {
    // Given / When / Then
    expect(runsToggleFrameProbe({ method: "toggle", frameProbeArm: true })).toBe(true);
    expect(runsToggleFrameProbe({ method: "both", frameProbeArm: true })).toBe(true);
    expect(runsToggleFrameProbe({ method: "relaunch", frameProbeArm: true })).toBe(false);
    expect(runsToggleFrameProbe({ method: "toggle", frameProbeArm: false })).toBe(false);
  });

  it("should read the arm on Electron too", () => {
    // Given
    const env = { BENCHMARK_OVERHEAD_FRAME_PROBE_ARM: "1" };

    // When
    const config = parseOverheadConfig(env, "electron");

    // Then
    expect(config.frameProbeArm).toBe(true);
  });
});

describe("toggleUaProbeVariants", () => {
  it("should run one toggle launch with the UA probe without the UA arm", () => {
    // Given / When / Then
    expect(toggleUaProbeVariants({ method: "toggle", uaArm: false })).toEqual([true]);
  });

  it("should add a toggle launch without the UA probe with the UA arm, after the probe-on one", () => {
    // Given / When / Then
    expect(toggleUaProbeVariants({ method: "both", uaArm: true })).toEqual([true, false]);
  });

  it("should run no toggle launch for method relaunch", () => {
    // Given / When / Then
    expect(toggleUaProbeVariants({ method: "relaunch", uaArm: true })).toEqual([]);
  });
});

describe("overheadArms", () => {
  it("should add the on-noUa arm only with the UA arm", () => {
    // Given / When / Then
    expect(overheadArms({ uaArm: false })).toEqual(["off", "on"]);
    expect(overheadArms({ uaArm: true })).toEqual(["off", "on", "on-noUa"]);
  });
});

describe("armOrder", () => {
  it("should alternate two arms in ABBA order", () => {
    // Given
    const arms = overheadArms({ uaArm: false });

    // When
    const orders = [0, 1, 2, 3].map((repeat) => armOrder(arms, repeat));

    // Then
    expect(orders).toEqual([
      ["off", "on"],
      ["on", "off"],
      ["off", "on"],
      ["on", "off"],
    ]);
  });

  it("should rotate three arms as a Latin square", () => {
    // Given
    const arms = overheadArms({ uaArm: true });

    // When
    const orders = [0, 1, 2].map((repeat) => armOrder(arms, repeat));

    // Then every arm takes every position once
    expect(orders).toEqual([
      ["off", "on", "on-noUa"],
      ["on", "on-noUa", "off"],
      ["on-noUa", "off", "on"],
    ]);
  });
});

describe("buildOverheadSchedule", () => {
  it("should put alternating warm-up runs before the measured repeats", () => {
    // Given / When
    const schedule = buildOverheadSchedule({ arms: ["off", "on"], repeats: 2, warmupRuns: 2 });

    // Then
    expect(schedule).toEqual([
      { arm: "off", warmup: true, repeat: -1, order: 0, sequence: 0 },
      { arm: "on", warmup: true, repeat: -1, order: 1, sequence: 1 },
      { arm: "off", warmup: false, repeat: 0, order: 0, sequence: 2 },
      { arm: "on", warmup: false, repeat: 0, order: 1, sequence: 3 },
      { arm: "on", warmup: false, repeat: 1, order: 0, sequence: 4 },
      { arm: "off", warmup: false, repeat: 1, order: 1, sequence: 5 },
    ]);
  });

  it("should schedule repeats × arms measured runs", () => {
    // Given / When
    const schedule = buildOverheadSchedule({
      arms: ["off", "on", "on-noUa"],
      repeats: 4,
      warmupRuns: 0,
    });

    // Then
    expect(schedule).toHaveLength(12);
    expect(schedule.every((entry) => !entry.warmup)).toBe(true);
  });
});

describe("armRunOptions", () => {
  it("should map arms to the telemetry and UA probe switches", () => {
    // Given / When / Then
    expect(armRunOptions("off")).toEqual({ telemetryEnabled: false });
    expect(armRunOptions("on")).toEqual({ telemetryEnabled: true });
    expect(armRunOptions("on-noUa")).toEqual({ telemetryEnabled: true, uaMemoryProbe: false });
  });
});

describe("overheadTestTimeoutMs", () => {
  it("should scale the timeout with the run count and the steady window", () => {
    // Given / When
    const defaultPolls = overheadTestTimeoutMs(12, 10);
    const twentyPolls = overheadTestTimeoutMs(12, 20);

    // Then: per run the setup budget plus the auto-pause (15 s with 10 polls, 25 s with 20)
    expect(defaultPolls).toBe(
      OVERHEAD_TIMEOUT_BASE_MS + 12 * (OVERHEAD_RUN_SETUP_BUDGET_MS + 15_000),
    );
    expect(twentyPolls - defaultPolls).toBe(12 * 10_000);
  });

  it("should add one toggle run with its setup budget and auto-pause", () => {
    // Given
    const toggle = { quartets: 4, blockMs: 3000 };

    // When
    const withToggle = overheadTestTimeoutMs(2, 10, toggle);
    const withoutToggle = overheadTestTimeoutMs(2, 10);

    // Then
    expect(withToggle - withoutToggle).toBe(
      OVERHEAD_RUN_SETUP_BUDGET_MS + overheadToggleAutoPauseMs(4, 3000),
    );
  });

  it("should add the setup budget and auto-pause once per toggle run", () => {
    // Given
    const toggle = { quartets: 4, blockMs: 3000 };

    // When
    const twoRuns = overheadTestTimeoutMs(2, 10, { ...toggle, runs: 2 });
    const oneRun = overheadTestTimeoutMs(2, 10, toggle);

    // Then
    expect(twoRuns - oneRun).toBe(
      OVERHEAD_RUN_SETUP_BUDGET_MS + overheadToggleAutoPauseMs(4, 3000),
    );
  });

  it("should add the profiled period once, not per toggle run", () => {
    // Given two toggle runs, the first one profiled for 10 s
    const toggle = { quartets: 4, blockMs: 3000, runs: 2 };

    // When
    const profiled = overheadTestTimeoutMs(0, 10, { ...toggle, profileMs: 10_000 });
    const unprofiled = overheadTestTimeoutMs(0, 10, toggle);

    // Then
    expect(profiled - unprofiled).toBe(10_000);
  });
});
