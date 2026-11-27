// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { SYSTEM_CLOCK } from "./steadyWindow";
import { toggleBlockArms } from "./toggleBlocks";
import type {
  CumulativeCpuReading,
  ToggleWindowRecording,
  ToggleWindowSamplingOptions,
} from "./toggleBlocks.types";
import { sampleToggleWindow } from "./toggleWindow";

// The sampler runs on `SYSTEM_CLOCK` under Jest's fake timers (`Date.now` and `setTimeout` are
// virtual). The fake app burns CPU at a rate depending on the page's telemetry state, so block CPU
// follows the toggles; page calls (toggles, drains) are fake sleeps.

const PAGE_CLOCK_OFFSET = 1_000_000;

type FakeAppProps = {
  /** CPU cores busy with telemetry off / on (default 0.5 / 0.6). */
  offCores?: number;
  onCores?: number;
  toggleCostMs?: number;
  drainCostMs?: number;
  /** Cumulative UA calls reported by the n-th `setActive` call. */
  uaCallsAt?: (call: number) => number;
  overrides?: Partial<ToggleWindowSamplingOptions>;
};

type FakeApp = {
  options: ToggleWindowSamplingOptions;
  /** Wall clock and state of every `setActive` call. */
  toggles: Array<{ atMs: number; active: boolean }>;
  /** Highest number of page calls (toggles + drains) in flight at once. */
  maxPageCallsInFlight: () => number;
  drains: () => number;
};

function fakeApp({
  offCores = 0.5,
  onCores = 0.6,
  toggleCostMs = 10,
  drainCostMs = 300,
  uaCallsAt = () => 0,
  overrides = {},
}: FakeAppProps = {}): FakeApp {
  let active = true;
  let cpuSec = 0;
  let lastMs = Date.now();
  let inFlight = 0;
  let maxInFlight = 0;
  let drains = 0;
  const toggles: FakeApp["toggles"] = [];
  const advanceCpu = (): void => {
    const now = Date.now();
    cpuSec += ((now - lastMs) / 1000) * (active ? onCores : offCores);
    lastMs = now;
  };
  const pageCall = async <T>(costMs: number, body: () => T): Promise<T> => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await SYSTEM_CLOCK.sleep(costMs);
    inFlight -= 1;
    return body();
  };
  const options: ToggleWindowSamplingOptions = {
    stamp: () => PAGE_CLOCK_OFFSET + Date.now(),
    setActive: async (arm) =>
      await pageCall(toggleCostMs, () => {
        advanceCpu();
        active = arm === "on";
        toggles.push({ atMs: Date.now(), active });
        return { uaCalls: uaCallsAt(toggles.length - 1) };
      }),
    readCpu: async (): Promise<CumulativeCpuReading[]> => {
      advanceCpu();
      return [{ pid: 1, processType: "renderer", cpuTimeSec: cpuSec }];
    },
    drain: async () => {
      await pageCall(drainCostMs, () => {
        drains += 1;
      });
    },
    arms: toggleBlockArms(2),
    warmupMs: 3000,
    blockMs: 3000,
    settleMs: 500,
    drainIntervalMs: 2000,
    clock: SYSTEM_CLOCK,
    ...overrides,
  };
  return { options, toggles, maxPageCallsInFlight: () => maxInFlight, drains: () => drains };
}

/** Runs the sampler to completion on the fake timers. */
async function sample(options: ToggleWindowSamplingOptions): Promise<ToggleWindowRecording> {
  const recording = sampleToggleWindow(options);
  await jest.runAllTimersAsync();
  return await recording;
}

beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("sampleToggleWindow", () => {
  it("should toggle at t0 + i × block after the warm-up in ABBA order, then restore on", async () => {
    // Given 2 quartets of 3 s blocks after a 3 s warm-up
    const app = fakeApp();

    // When
    const recording = await sample(app.options);

    // Then: one toggle per block (10 ms round trip) plus the final restore
    expect(recording.blocks.map((block) => block.arm)).toEqual([
      "off",
      "on",
      "on",
      "off",
      "off",
      "on",
      "on",
      "off",
    ]);
    expect(app.toggles.map((toggle) => toggle.atMs)).toEqual([
      3010, 6010, 9010, 12010, 15010, 18010, 21010, 24010, 27010,
    ]);
    expect(app.toggles.map((toggle) => toggle.active)).toEqual([
      false,
      true,
      true,
      false,
      false,
      true,
      true,
      false,
      true,
    ]);
    expect(recording.blocks.every((block) => block.toggleLatencyMs === 10)).toBe(true);
    expect(recording.blocks.some((block) => block.lateStart)).toBe(false);
  });

  it("should measure each block from the settle point to its end on the page clock", async () => {
    // Given
    const app = fakeApp();

    // When
    const recording = await sample(app.options);

    // Then: block 0 measures [3500, 6000] wall = page clock + offset
    const first = recording.blocks[0]!;
    expect(first.startMonotonicTs).toBe(PAGE_CLOCK_OFFSET + 3500);
    expect(first.endMonotonicTs).toBe(PAGE_CLOCK_OFFSET + 6000);
    expect(first.measuredMs).toBe(2500);
  });

  it("should derive each block's CPU from the cumulative CPU time of its arm", async () => {
    // Given 0.5 cores busy with telemetry off, 0.6 with telemetry on
    const app = fakeApp();

    // When
    const recording = await sample(app.options);

    // Then
    for (const block of recording.blocks) {
      expect(block.cpu.cpuPercent).toBeCloseTo(block.arm === "on" ? 60 : 50, 6);
      expect(block.cpu.processSet).toEqual({ renderer: 1 });
    }
  });

  it("should never overlap a toggle with a drain and count waiting in the latency", async () => {
    // Given 800 ms drains every second, so every block start meets an in-flight drain
    const app = fakeApp({
      drainCostMs: 800,
      overrides: { drainIntervalMs: 1000, arms: toggleBlockArms(2) },
    });

    // When
    const recording = await sample(app.options);

    // Then
    expect(app.maxPageCallsInFlight()).toBe(1);
    expect(app.drains()).toBeGreaterThan(0);
    expect(recording.blocks.every((block) => block.toggleLatencyMs >= 10)).toBe(true);
  });

  it("should mark a toggle that overruns the settle period as a late start", async () => {
    // Given a 700 ms toggle round trip and a 500 ms settle period
    const app = fakeApp({
      toggleCostMs: 700,
      overrides: { arms: toggleBlockArms(1) },
    });

    // When
    const recording = await sample(app.options);

    // Then: the measurement starts right after the toggle
    const first = recording.blocks[0]!;
    expect(first.lateStart).toBe(true);
    expect(first.toggleLatencyMs).toBe(700);
    expect(first.startMonotonicTs).toBe(PAGE_CLOCK_OFFSET + 3700);
  });

  it("should attribute UA calls to blocks from the cumulative counts of consecutive toggles", async () => {
    // Given cumulative UA counts 2 (warm-up), 2, 3, 5, 5 at the toggles of 1 quartet and the restore
    const counts = [2, 2, 3, 5, 5];
    const app = fakeApp({
      uaCallsAt: (call) => counts[call]!,
      overrides: { arms: toggleBlockArms(1) },
    });

    // When
    const recording = await sample(app.options);

    // Then
    expect(recording.warmupUaCalls).toBe(2);
    expect(recording.blocks.map((block) => block.uaCalls)).toEqual([0, 1, 2, 0]);
  });

  it("should profile after the restore with telemetry on and the drains still running", async () => {
    // Given a 5 s profiled period after 1 quartet
    let profiledAt: { atMs: number; active: boolean; drains: number } | undefined;
    const app = fakeApp({ overrides: { arms: toggleBlockArms(1) } });
    const options: ToggleWindowSamplingOptions = {
      ...app.options,
      profile: async () => {
        const startDrains = app.drains();
        const atMs = Date.now();
        await SYSTEM_CLOCK.sleep(5000);
        profiledAt = {
          atMs,
          active: app.toggles.at(-1)!.active,
          drains: app.drains() - startDrains,
        };
        return { status: "unsupported", reason: "fake" };
      },
    };

    // When
    const recording = await sample(options);

    // Then: it starts after the last block and the restore toggle, never overlapping a block
    const lastBlockEndMs = 3000 + 4 * 3000;
    expect(profiledAt?.atMs).toBeGreaterThanOrEqual(lastBlockEndMs);
    expect(profiledAt?.active).toBe(true);
    expect(profiledAt?.drains).toBeGreaterThan(0);
    expect(recording.profile).toEqual({ status: "unsupported", reason: "fake" });
  });

  it("should not profile without a profile callback", async () => {
    // Given
    const app = fakeApp({ overrides: { arms: toggleBlockArms(1) } });

    // When
    const recording = await sample(app.options);

    // Then
    expect(recording.profile).toBeUndefined();
  });

  it("should stop draining and reject when a CPU read fails", async () => {
    // Given
    const app = fakeApp({
      overrides: {
        readCpu: async () => {
          throw new Error("CDP gone");
        },
      },
    });

    // When
    const recording = sampleToggleWindow(app.options);
    const rejection = recording.then(
      () => undefined,
      (error: unknown) => error,
    );
    await jest.runAllTimersAsync();

    // Then
    await expect(rejection).resolves.toThrow("CDP gone");
    expect(jest.getTimerCount()).toBe(0);
  });
});
