// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  SYSTEM_CLOCK,
  sampleSteadyWindow,
  slotWait,
  startDrainLoop,
  steadyScenarioDurationMs,
  steadySlotMs,
} from "./steadyWindow";
import type { SteadyWindowRecording, SteadyWindowSamplingOptions } from "./steadyWindow.types";

// The loops run on `SYSTEM_CLOCK` under Jest's fake timers (`Date.now` and `setTimeout` are
// virtual), so polls, drains and probe reads interleave as in a real run. Costs are fake sleeps.

const PAGE_CLOCK_OFFSET = 1_000_000;

type FakePage = {
  options: SteadyWindowSamplingOptions;
  /** Wall-clock start of every host poll (warm-up, priming and steady). */
  pollStarts: number[];
  /** Wall-clock [start, end] of every drain. */
  drains: Array<[number, number]>;
  /** Highest number of page calls (drains + probe reads) in flight at once. */
  maxPageCallsInFlight: () => number;
};

/**
 * A fake run: host polls cost `pollCostMs(index)`, drains `drainCostMs`, probe reads `probeCostMs`
 * (page calls on a busy renderer are slow, host polls are not).
 */
function fakePage({
  pollCostMs = () => 50,
  drainCostMs = 300,
  probeCostMs = 0,
  overrides = {},
}: {
  pollCostMs?: (index: number) => number;
  drainCostMs?: number;
  probeCostMs?: number;
  overrides?: Partial<SteadyWindowSamplingOptions>;
} = {}): FakePage {
  const pollStarts: number[] = [];
  const drains: Array<[number, number]> = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const pageCall = async <T>(costMs: number, result: () => T): Promise<T> => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await SYSTEM_CLOCK.sleep(costMs);
    inFlight -= 1;
    return result();
  };
  const options: SteadyWindowSamplingOptions = {
    stamp: () => PAGE_CLOCK_OFFSET + Date.now(),
    poll: async () => {
      const index = pollStarts.length;
      pollStarts.push(Date.now());
      await SYSTEM_CLOCK.sleep(pollCostMs(index));
    },
    drain: async () => {
      const start = Date.now();
      await pageCall(drainCostMs, () => undefined);
      drains.push([start, Date.now()]);
    },
    readProbe: async () =>
      await pageCall(probeCostMs, () => ({ longTaskMs: 0, frames: 0, nowMs: Date.now() })),
    warmupMs: 3000,
    polls: 10,
    intervalMs: 1000,
    drainIntervalMs: 2000,
    clock: SYSTEM_CLOCK,
    ...overrides,
  };
  return { options, pollStarts, drains, maxPageCallsInFlight: () => maxInFlight };
}

/** Runs the sampler to completion on the fake timers. */
async function sample(options: SteadyWindowSamplingOptions): Promise<SteadyWindowRecording> {
  const recording = sampleSteadyWindow(options);
  await jest.runAllTimersAsync();
  return await recording;
}

function gaps(values: readonly number[]): number[] {
  return values.slice(1).map((value, index) => value - values[index]!);
}

beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("steadySlotMs / slotWait", () => {
  it("should place slots at t0 + i × interval and detect missed slots", () => {
    // Given / When / Then
    expect(steadySlotMs(500, 3, 1000)).toBe(3500);
    expect(slotWait(900, 1000)).toEqual({ waitMs: 100, overrun: false });
    expect(slotWait(1000, 1000)).toEqual({ waitMs: 0, overrun: false });
    expect(slotWait(1250, 1000)).toEqual({ waitMs: 0, overrun: true });
  });
});

describe("SYSTEM_CLOCK.sleep", () => {
  it("should resolve early when its signal aborts", async () => {
    // Given
    const controller = new AbortController();
    const sleep = SYSTEM_CLOCK.sleep(5000, controller.signal);

    // When
    await jest.advanceTimersByTimeAsync(100);
    controller.abort();
    await sleep;

    // Then
    expect(Date.now()).toBe(100);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("startDrainLoop", () => {
  it("should drain right away, then every interval, one drain at a time", async () => {
    // Given drains of 300 ms
    const starts: number[] = [];
    const loop = startDrainLoop({
      drain: async () => {
        starts.push(Date.now());
        await SYSTEM_CLOCK.sleep(300);
      },
      intervalMs: 2000,
      clock: SYSTEM_CLOCK,
    });

    // When
    await jest.advanceTimersByTimeAsync(5000);
    const stopped = loop.stop();
    await jest.runAllTimersAsync();
    await stopped;

    // Then: the sleep pending at 5000 is cut short, no drain starts after stop()
    expect(starts).toEqual([0, 2000, 4000]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("should start the next drain right after a drain slower than the interval", async () => {
    // Given drains of 2500 ms
    const starts: number[] = [];
    const loop = startDrainLoop({
      drain: async () => {
        starts.push(Date.now());
        await SYSTEM_CLOCK.sleep(2500);
      },
      intervalMs: 2000,
      clock: SYSTEM_CLOCK,
    });

    // When
    await jest.advanceTimersByTimeAsync(6000);
    const stopped = loop.stop();
    await jest.runAllTimersAsync();
    await stopped;

    // Then: back to back, never overlapping; the drain in flight at stop() completes
    expect(starts).toEqual([0, 2500, 5000]);
    expect(Date.now()).toBe(7500);
  });

  it("should reject stop() with a drain's failure", async () => {
    // Given
    const loop = startDrainLoop({
      drain: async () => {
        throw new Error("page gone");
      },
      intervalMs: 2000,
      clock: SYSTEM_CLOCK,
    });

    // When
    const stopped = loop.stop();

    // Then
    await expect(stopped).rejects.toThrow("page gone");
  });
});

describe("sampleSteadyWindow", () => {
  it("should take a priming poll after the warm-up, then exactly `polls` polls on the schedule", async () => {
    // Given host polls of 50 ms and drains of 300 ms
    const page = fakePage();

    // When
    const recording = await sample(page.options);

    // Then: 3 warm-up polls, a priming poll at t0 = 3000, steady polls at 4000…13000
    expect(page.pollStarts.slice(0, 3)).toEqual([0, 1000, 2000]);
    expect(page.pollStarts[3]).toBe(3000);
    expect(page.pollStarts.slice(4)).toEqual(Array.from({ length: 10 }, (_, i) => 4000 + i * 1000));
    expect(recording.pollTimestamps).toHaveLength(10);
    expect(recording.overruns).toBe(0);
    expect(recording.maxPollLatencyMs).toBe(50);
    expect(recording.startMonotonicTs).toBe(PAGE_CLOCK_OFFSET + 3000);
    expect(recording.endMonotonicTs).toBe(PAGE_CLOCK_OFFSET + 13_000);
    expect(recording.mainThreadStart?.nowMs).toBe(3000);
    expect(recording.mainThreadEnd?.nowMs).toBe(13_050);
    // Drains every 2 s from the start, none after the last poll
    expect(page.drains.map(([start]) => start)).toEqual([
      0, 2000, 4000, 6000, 8000, 10_000, 12_000,
    ]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("should keep polls on schedule when page calls are slow (busy renderer)", async () => {
    // Given drains of 2.5 s and probe reads of 800 ms, host polls of 50 ms
    const page = fakePage({ drainCostMs: 2500, probeCostMs: 800 });

    // When
    const recording = await sample(page.options);

    // Then: no overrun, polls exactly 1 s apart, page calls never overlap
    expect(recording.overruns).toBe(0);
    expect(recording.pollTimestamps).toHaveLength(10);
    expect(gaps(recording.pollTimestamps)).toEqual(Array.from({ length: 9 }, () => 1000));
    expect(recording.maxPollLatencyMs).toBe(50);
    expect(page.maxPageCallsInFlight()).toBe(1);
    expect(page.drains.length).toBeGreaterThan(3);
  });

  it("should read the end probe after the in-flight drain and start no drain after the window", async () => {
    // Given drains of 1.5 s
    const page = fakePage({ drainCostMs: 1500 });

    // When
    const recording = await sample(page.options);

    // Then
    const lastPollStart = page.pollStarts.at(-1)!;
    const [lastDrainStart, lastDrainEnd] = page.drains.at(-1)!;
    expect(lastDrainStart).toBeLessThan(lastPollStart + 50);
    expect(recording.mainThreadEnd!.nowMs).toBeGreaterThanOrEqual(lastDrainEnd);
    expect(page.maxPageCallsInFlight()).toBe(1);
  });

  it("should keep the poll count, count overruns and report the slowest poll", async () => {
    // Given the 6th poll overall (2nd steady poll) takes 2.5 s
    const page = fakePage({ pollCostMs: (index) => (index === 5 ? 2500 : 50) });

    // When
    const recording = await sample(page.options);

    // Then: slots 3 and 4 were missed (polled late), still 10 polls
    expect(recording.pollTimestamps).toHaveLength(10);
    expect(recording.overruns).toBe(2);
    expect(recording.maxPollLatencyMs).toBe(2500);
  });

  it("should omit probe readings when the probe is unavailable", async () => {
    // Given
    const page = fakePage({ overrides: { readProbe: async () => undefined, polls: 2 } });

    // When
    const recording = await sample(page.options);

    // Then
    expect(recording.mainThreadStart).toBeUndefined();
    expect(recording.mainThreadEnd).toBeUndefined();
    expect(recording.pollTimestamps).toHaveLength(2);
  });

  it("should stop draining and reject when a host poll fails", async () => {
    // Given the 5th poll (priming) fails
    const page = fakePage({
      overrides: {
        poll: async () => {
          if (Date.now() >= 3000) {
            throw new Error("collector failed");
          }
        },
      },
    });

    // When
    const recording = sampleSteadyWindow(page.options);
    const settled = recording.then(
      () => undefined,
      (error: unknown) => error,
    );
    await jest.runAllTimersAsync();

    // Then
    expect(await settled).toEqual(new Error("collector failed"));
    expect(jest.getTimerCount()).toBe(0);
  });

  it("should reject with a drain's failure after the window", async () => {
    // Given
    const page = fakePage({
      overrides: {
        polls: 2,
        drain: async () => {
          throw new Error("page gone");
        },
      },
    });

    // When
    const recording = sampleSteadyWindow(page.options);
    const settled = recording.then(
      () => undefined,
      (error: unknown) => error,
    );
    await jest.runAllTimersAsync();

    // Then
    expect(await settled).toEqual(new Error("page gone"));
  });
});

describe("steadyScenarioDurationMs", () => {
  it("should cover warm-up, polls and the margin", () => {
    // Given / When / Then
    expect(
      steadyScenarioDurationMs({ warmupMs: 3000, polls: 10, intervalMs: 1000, marginMs: 2000 }),
    ).toBe(15_000);
  });
});
