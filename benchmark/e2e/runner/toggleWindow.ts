// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { startDrainLoop } from "./steadyWindow";
import { blockCpu } from "./toggleBlocks";
import type {
  CumulativeCpuReading,
  ToggleArm,
  ToggleBlockRecording,
  ToggleWindowRecording,
  ToggleWindowSamplingOptions,
} from "./toggleBlocks.types";
import { createSerialQueue, runSequentially } from "../shared/sequential";

type TimedCpuRead = { readings: CumulativeCpuReading[]; ts: number; wallMs: number };

/**
 * Toggle A/B sampling (`runner/toggleBlocks.ts`): `warmupMs` with telemetry on, then one block per
 * entry of `arms` on a fixed schedule (`t0 + index × blockMs`). Each block:
 *
 * 1. `setActive(arm)` at the block start (page call, queued with the drains so the two
 *    never overlap) and its round trip as `toggleLatencyMs`;
 * 2. the settle period (`settleMs` from the block start; a toggle overrunning it marks `lateStart`
 *    and the measurement starts right after it);
 * 3. cumulative CPU read at the measured start and at the block end (no page call; the wall time of
 *    each read is its midpoint).
 *
 * Telemetry drains run in their own loop throughout (every `drainIntervalMs`). After the last
 * block telemetry is switched back on, so teardown records (e.g. `datasource.close`) are captured;
 * that final call's cumulative UA count closes the last block's `uaCalls`. The optional profiled
 * period (`profile`) follows, so it never overlaps a block, with the drains still running as in
 * the on blocks.
 */
export async function sampleToggleWindow(
  options: ToggleWindowSamplingOptions,
): Promise<ToggleWindowRecording> {
  const { stamp, readCpu, arms, warmupMs, blockMs, settleMs, clock } = options;
  const pageCalls = createSerialQueue();
  const setActive = async (arm: ToggleArm) =>
    await pageCalls.run(async () => await options.setActive(arm));
  const drainLoop = startDrainLoop({
    drain: async () => {
      await pageCalls.run(options.drain);
    },
    intervalMs: options.drainIntervalMs,
    clock,
  });
  const sleepUntil = async (wallMs: number): Promise<void> => {
    const waitMs = wallMs - clock.now();
    if (waitMs > 0) {
      await clock.sleep(waitMs);
    }
  };
  const timedRead = async (): Promise<TimedCpuRead> => {
    const before = clock.now();
    const ts = stamp();
    const readings = await readCpu();
    return { readings, ts, wallMs: (before + clock.now()) / 2 };
  };

  try {
    await clock.sleep(warmupMs);
    const t0 = clock.now();
    const blocks: Omit<ToggleBlockRecording, "uaCalls">[] = [];
    const uaCounts: number[] = [];
    await runSequentially(arms.length, async (index) => {
      const arm = arms[index]!;
      const blockStart = t0 + index * blockMs;
      await sleepUntil(blockStart);
      const toggleStarted = clock.now();
      const { uaCalls } = await setActive(arm);
      const toggleLatencyMs = clock.now() - toggleStarted;
      uaCounts.push(uaCalls);
      const lateStart = clock.now() > blockStart + settleMs;
      await sleepUntil(blockStart + settleMs);
      const start = await timedRead();
      await sleepUntil(blockStart + blockMs);
      const end = await timedRead();
      const measuredMs = end.wallMs - start.wallMs;
      blocks.push({
        index,
        arm,
        startMonotonicTs: start.ts,
        endMonotonicTs: end.ts,
        measuredMs,
        cpu: blockCpu(start.readings, end.readings, measuredMs),
        toggleLatencyMs,
        lateStart,
      });
    });
    const restored = await setActive("on");
    uaCounts.push(restored.uaCalls);
    const profile = options.profile != undefined ? await options.profile() : undefined;
    await drainLoop.stop();
    return {
      blocks: blocks.map((block, index) => ({
        ...block,
        uaCalls: uaCounts[index + 1]! - uaCounts[index]!,
      })),
      warmupUaCalls: uaCounts[0] ?? restored.uaCalls,
      ...(profile != undefined && { profile }),
    };
  } catch (error) {
    // The window failed: stop draining (its own failure, if any, is secondary).
    await drainLoop.stop().catch(() => undefined);
    throw error;
  }
}
