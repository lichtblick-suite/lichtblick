// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Overhead A/B run plan: env knobs, arms and their run order. Pure (no Playwright).

import {
  OVERHEAD_DEFAULT_METHOD,
  OVERHEAD_DEFAULT_REPEATS,
  OVERHEAD_DEFAULT_WARMUP_RUNS,
  OVERHEAD_ENV,
  OVERHEAD_METHODS,
  OVERHEAD_MIN_STEADY_POLLS,
  OVERHEAD_PROFILE_DEFAULT_MS,
  OVERHEAD_RUN_SETUP_BUDGET_MS,
  OVERHEAD_STEADY_POLLS,
  OVERHEAD_TIMEOUT_BASE_MS,
  OVERHEAD_TOGGLE_DEFAULT_BLOCK_MS,
  OVERHEAD_TOGGLE_DEFAULT_QUARTETS,
  OVERHEAD_TOGGLE_MIN_BLOCK_MS,
  OVERHEAD_TOGGLE_MIN_QUARTETS,
} from "./constants";
import type {
  OverheadArm,
  OverheadEnvConfig,
  OverheadMethod,
  ScheduledOverheadRun,
} from "./overhead.types";
import { overheadAutoPauseMs, overheadToggleAutoPauseMs } from "./overheadFixtures";
import type { BenchmarkPlatform, RunScenarioOptions } from "./types";

/** Non-negative integer env value ≥ `min`, else `fallback` (unset, blank or not an integer). */
function parseCount(value: string | undefined, fallback: number, min: number): number {
  if (value == undefined || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.max(min, parsed);
}

/**
 * `BENCHMARK_OVERHEAD_METHOD` (`toggle` / `relaunch` / `both`, case-insensitive); default `both`.
 * Throws for any other value, so a typo never silently runs the slow default.
 */
export function parseOverheadMethod(value: string | undefined): OverheadMethod {
  if (value == undefined || value.trim() === "") {
    return OVERHEAD_DEFAULT_METHOD;
  }
  const method = OVERHEAD_METHODS.find((candidate) => candidate === value.trim().toLowerCase());
  if (method == undefined) {
    throw new Error(`${OVERHEAD_ENV.method}=${value} is not one of ${OVERHEAD_METHODS.join(", ")}`);
  }
  return method;
}

/** The method runs the in-process toggle A/B (`toggle`, `both`). */
export function runsToggle(method: OverheadMethod): boolean {
  return method !== "relaunch";
}

/** The method runs the relaunch A/B (`relaunch`, `both`). */
export function runsRelaunch(method: OverheadMethod): boolean {
  return method !== "toggle";
}

/**
 * UA memory probe setting of each toggle launch: `[true]` (probe on, the `toggle` section), plus
 * `false` (a second launch with `?telemetry.uaMemory=off`, `toggleWithoutUaProbe`) with the UA arm;
 * `[]` for method `relaunch`.
 */
export function toggleUaProbeVariants({
  method,
  uaArm,
}: Pick<OverheadEnvConfig, "method" | "uaArm">): boolean[] {
  if (!runsToggle(method)) {
    return [];
  }
  return uaArm ? [true, false] : [true];
}

/** The frame-probe toggle launch runs: method with toggle and `BENCHMARK_OVERHEAD_FRAME_PROBE_ARM=1`. */
export function runsToggleFrameProbe({
  method,
  frameProbeArm,
}: Pick<OverheadEnvConfig, "method" | "frameProbeArm">): boolean {
  return runsToggle(method) && frameProbeArm;
}

/**
 * Overhead env knobs: `BENCHMARK_OVERHEAD_METHOD` (see `parseOverheadMethod`),
 * `BENCHMARK_OVERHEAD_REPEATS` (default 5, min 1),
 * `BENCHMARK_OVERHEAD_WARMUP_RUNS` (default 1, min 0), `BENCHMARK_OVERHEAD_POLLS` (steady polls per
 * run, default `OVERHEAD_STEADY_POLLS` = 10, min `OVERHEAD_MIN_STEADY_POLLS` = 5),
 * `BENCHMARK_OVERHEAD_UA_ARM=1` (web only, where the UA-specific memory probe runs; ignored on
 * Electron: the relaunch `on-noUa` arm and a toggle launch without the probe), `BENCHMARK_OVERHEAD_GATE=1`, and for the toggle A/B
 * `BENCHMARK_OVERHEAD_TOGGLE_QUARTETS` (ABBA quartets of 4 blocks, default 10, min 4) and
 * `BENCHMARK_OVERHEAD_TOGGLE_BLOCK_MS` (default 3000, min 1000), and `BENCHMARK_OVERHEAD_PROFILE_MS`
 * (profiled period of the direct CPU attribution after the toggle blocks, default 10000, 0 off),
 * `BENCHMARK_OVERHEAD_FRAME_PROBE_ARM=1` (the frame-probe toggle launch, default off).
 */
export function parseOverheadConfig(
  env: NodeJS.ProcessEnv,
  platform: BenchmarkPlatform,
): OverheadEnvConfig {
  return {
    method: parseOverheadMethod(env[OVERHEAD_ENV.method]),
    repeats: parseCount(env[OVERHEAD_ENV.repeats], OVERHEAD_DEFAULT_REPEATS, 1),
    warmupRuns: parseCount(env[OVERHEAD_ENV.warmupRuns], OVERHEAD_DEFAULT_WARMUP_RUNS, 0),
    polls: parseCount(env[OVERHEAD_ENV.polls], OVERHEAD_STEADY_POLLS, OVERHEAD_MIN_STEADY_POLLS),
    uaArm: platform === "web" && env[OVERHEAD_ENV.uaArm] === "1",
    gate: env[OVERHEAD_ENV.gate] === "1",
    toggleQuartets: parseCount(
      env[OVERHEAD_ENV.toggleQuartets],
      OVERHEAD_TOGGLE_DEFAULT_QUARTETS,
      OVERHEAD_TOGGLE_MIN_QUARTETS,
    ),
    toggleBlockMs: parseCount(
      env[OVERHEAD_ENV.toggleBlockMs],
      OVERHEAD_TOGGLE_DEFAULT_BLOCK_MS,
      OVERHEAD_TOGGLE_MIN_BLOCK_MS,
    ),
    profileMs: parseCount(env[OVERHEAD_ENV.profileMs], OVERHEAD_PROFILE_DEFAULT_MS, 0),
    frameProbeArm: env[OVERHEAD_ENV.frameProbeArm] === "1",
  };
}

/** Arms of the A/B: off and on, plus `on-noUa` with the UA arm. */
export function overheadArms({ uaArm }: Pick<OverheadEnvConfig, "uaArm">): OverheadArm[] {
  return uaArm ? ["off", "on", "on-noUa"] : ["off", "on"];
}

/**
 * Run order of the arms in measured repeat `repeat`. Two arms: ABBA (even repeats off → on, odd
 * on → off), so a drift with run position (warm caches, thermal state) cancels over pairs. More
 * arms: a cyclic Latin square (the order rotates by one per repeat, so every arm takes every
 * position once per `arms.length` repeats).
 */
export function armOrder(arms: readonly OverheadArm[], repeat: number): OverheadArm[] {
  const shift = repeat % arms.length;
  if (arms.length === 2) {
    return shift === 0 ? [...arms] : [...arms].reverse();
  }
  return [...arms.slice(shift), ...arms.slice(0, shift)];
}

/**
 * The full run plan: `warmupRuns` discarded runs (alternating arms) first, then `repeats` measured
 * repeats of all arms in `armOrder`. Every run is a fresh app instance.
 */
export function buildOverheadSchedule({
  arms,
  repeats,
  warmupRuns,
}: {
  arms: readonly OverheadArm[];
  repeats: number;
  warmupRuns: number;
}): ScheduledOverheadRun[] {
  const schedule: ScheduledOverheadRun[] = [];
  for (let index = 0; index < warmupRuns; index++) {
    schedule.push({
      arm: arms[index % arms.length]!,
      warmup: true,
      repeat: -1,
      order: index,
      sequence: schedule.length,
    });
  }
  for (let repeat = 0; repeat < repeats; repeat++) {
    armOrder(arms, repeat).forEach((arm, order) => {
      schedule.push({ arm, warmup: false, repeat, order, sequence: schedule.length });
    });
  }
  return schedule;
}

/** `runScenario` options of an arm (telemetry and UA probe switches). */
export function armRunOptions(
  arm: OverheadArm,
): Pick<RunScenarioOptions, "telemetryEnabled" | "uaMemoryProbe"> {
  switch (arm) {
    case "off":
      return { telemetryEnabled: false };
    case "on":
      return { telemetryEnabled: true };
    case "on-noUa":
      return { telemetryEnabled: true, uaMemoryProbe: false };
  }
}

/**
 * Playwright test timeout for `runCount` relaunch runs of `polls` steady polls plus, with `toggle`,
 * `toggle.runs` toggle runs (default 1): a fixed base plus, per run, the setup budget and the run's
 * page auto-pause (warm-up + polls or blocks + margin), plus the profiled period of the primary
 * toggle run (`toggle.profileMs`, default 0) once.
 */
export function overheadTestTimeoutMs(
  runCount: number,
  polls: number,
  toggle?: { quartets: number; blockMs: number; runs?: number; profileMs?: number },
): number {
  const toggleMs =
    toggle == undefined
      ? 0
      : (toggle.runs ?? 1) *
          (OVERHEAD_RUN_SETUP_BUDGET_MS +
            overheadToggleAutoPauseMs(toggle.quartets, toggle.blockMs)) +
        (toggle.profileMs ?? 0);
  return (
    OVERHEAD_TIMEOUT_BASE_MS +
    runCount * (OVERHEAD_RUN_SETUP_BUDGET_MS + overheadAutoPauseMs(polls)) +
    toggleMs
  );
}
