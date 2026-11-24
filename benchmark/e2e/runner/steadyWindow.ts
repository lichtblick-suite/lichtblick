// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type {
  DrainLoop,
  SamplingClock,
  SteadyWindowRecording,
  SteadyWindowSamplingOptions,
} from "./steadyWindow.types";
import { createSerialQueue, repeatWhile, runSequentially } from "../shared/sequential";

/** Real wall clock of the sampling loops; `sleep` ends early when its signal aborts. */
export const SYSTEM_CLOCK: SamplingClock = {
  now: () => Date.now(),
  sleep: async (ms, signal) => {
    if (signal?.aborted === true) {
      return;
    }
    await new Promise<void>((resolve) => {
      const pending: { timer?: ReturnType<typeof setTimeout> } = {};
      const finish = (): void => {
        clearTimeout(pending.timer);
        signal?.removeEventListener("abort", finish);
        resolve();
      };
      pending.timer = setTimeout(finish, ms);
      signal?.addEventListener("abort", finish, { once: true });
    });
  },
};

/**
 * Wall-clock slot of steady poll `index` (0 = the priming poll at `t0Ms`): `t0 + index × interval`.
 */
export function steadySlotMs(t0Ms: number, index: number, intervalMs: number): number {
  return t0Ms + index * intervalMs;
}

/**
 * How long to wait for `slotMs` at `nowMs`, and whether the slot was already missed (the previous
 * poll ended after it: an overrun). A missed slot is polled right away.
 */
export function slotWait(nowMs: number, slotMs: number): { waitMs: number; overrun: boolean } {
  return { waitMs: Math.max(0, slotMs - nowMs), overrun: nowMs > slotMs };
}

/**
 * Telemetry drain loop of a steady window: `drain()` right away, then every `intervalMs` (measured
 * from the previous drain's start), each one awaited before the next, until `stop()`. A failed
 * drain ends the loop; `stop()` then rejects with that failure.
 */
export function startDrainLoop({
  drain,
  intervalMs,
  clock,
}: {
  drain: () => Promise<void>;
  intervalMs: number;
  clock: SamplingClock;
}): DrainLoop {
  const controller = new AbortController();
  const { signal } = controller;
  const loop = repeatWhile(
    () => !signal.aborted,
    async () => {
      const startedMs = clock.now();
      await drain();
      const waitMs = intervalMs - (clock.now() - startedMs);
      if (waitMs > 0) {
        await clock.sleep(waitMs, signal);
      }
    },
  );
  // Handled here so a failure while the window still runs is not an unhandled rejection; `stop()`
  // still rejects with it.
  loop.catch(() => undefined);
  return {
    stop: async () => {
      controller.abort();
      await loop;
    },
  };
}

type TimedPoll = () => Promise<{ ts: number; latencyMs: number }>;

/** Warm-up: 1 Hz host polls for `warmupMs` (keeps "CPU since the previous poll" fresh). */
async function runWarmup(
  { warmupMs, intervalMs, clock }: SteadyWindowSamplingOptions,
  timedPoll: TimedPoll,
): Promise<void> {
  const warmupEnd = clock.now() + warmupMs;
  await repeatWhile(
    () => clock.now() < warmupEnd,
    async () => {
      const tickStart = clock.now();
      await timedPoll();
      const remaining = Math.min(intervalMs - (clock.now() - tickStart), warmupEnd - clock.now());
      if (remaining > 0) {
        await clock.sleep(remaining);
      }
    },
  );
}

/** Warm-up, probe, priming poll, the scheduled polls, then the drain loop's stop and the probe. */
async function sampleWindow(
  options: SteadyWindowSamplingOptions,
  {
    drainLoop,
    readProbe,
  }: { drainLoop: DrainLoop; readProbe: SteadyWindowSamplingOptions["readProbe"] },
): Promise<SteadyWindowRecording> {
  const { stamp, poll, polls, intervalMs, clock } = options;
  const timedPoll: TimedPoll = async () => {
    const ts = stamp();
    const startedMs = clock.now();
    await poll(ts);
    return { ts, latencyMs: clock.now() - startedMs };
  };
  await runWarmup(options, timedPoll);

  // Before t0: a probe read queued behind a slow drain only delays the window's start.
  const mainThreadStart = await readProbe();
  const t0 = clock.now();
  const priming = await timedPoll();
  let maxPollLatencyMs = priming.latencyMs;
  const pollTimestamps: number[] = [];
  let overruns = 0;
  await runSequentially(polls, async (index) => {
    const { waitMs, overrun } = slotWait(clock.now(), steadySlotMs(t0, index + 1, intervalMs));
    if (overrun) {
      overruns += 1;
    }
    if (waitMs > 0) {
      await clock.sleep(waitMs);
    }
    const { ts, latencyMs } = await timedPoll();
    pollTimestamps.push(ts);
    maxPollLatencyMs = Math.max(maxPollLatencyMs, latencyMs);
  });
  // No drain starts after the last poll; the probe runs once the in-flight one (if any) is done.
  const stopped = drainLoop.stop();
  const mainThreadEnd = await readProbe();
  await stopped;
  return {
    pollTimestamps,
    overruns,
    maxPollLatencyMs,
    startMonotonicTs: priming.ts,
    endMonotonicTs: pollTimestamps.at(-1) ?? priming.ts,
    ...(mainThreadStart != undefined && { mainThreadStart }),
    ...(mainThreadEnd != undefined && { mainThreadEnd }),
  };
}

/**
 * Overhead A/B sampling (`measurement.mode = "steady"`): `warmupMs` of 1 Hz host polls, then a
 * priming poll at `t0` (host CPU is "since the previous poll", so the first steady poll must not
 * cover the warm-up) and exactly `polls` polls at `t0 + i × intervalMs` (i = 1…polls), on a fixed
 * schedule instead of a deadline: slow polls never drop polls, they are counted as `overruns`.
 *
 * The poll schedule makes no page call: polls are stamped by `stamp()` (Node clock + offset) and
 * `poll` only collects host metrics. Page calls (telemetry drains every `drainIntervalMs` from the
 * start, the main-thread probe before `t0` and after the last poll) run strictly one at a time in
 * their own queue, so a busy renderer delays them but never a poll.
 */
export async function sampleSteadyWindow(
  options: SteadyWindowSamplingOptions,
): Promise<SteadyWindowRecording> {
  const pageCalls = createSerialQueue();
  const drainLoop = startDrainLoop({
    drain: async () => {
      await pageCalls.run(options.drain);
    },
    intervalMs: options.drainIntervalMs,
    clock: options.clock,
  });
  try {
    return await sampleWindow(options, {
      drainLoop,
      readProbe: async () => await pageCalls.run(options.readProbe),
    });
  } catch (error) {
    // The window failed: stop draining (its own failure, if any, is secondary).
    await drainLoop.stop().catch(() => undefined);
    throw error;
  }
}

/**
 * Page auto-pause duration (`?scenario.durationMs=`) for a steady window: warm-up + polls + margin,
 * so a scenario's own pause never lands inside the window.
 */
export function steadyScenarioDurationMs({
  warmupMs,
  polls,
  intervalMs,
  marginMs,
}: {
  warmupMs: number;
  polls: number;
  intervalMs: number;
  marginMs: number;
}): number {
  return warmupMs + polls * intervalMs + marginMs;
}
