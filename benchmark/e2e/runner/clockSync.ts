// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Node → page clock offset (NTP-style), so the steady window of an overhead A/B run can stamp its
// host polls with the page's monotonic clock without a page round trip per poll (a busy renderer
// would delay every such call).

import { performance } from "node:perf_hooks";

import type { ClockOffset, ClockSyncSample, SyncPageClockOptions } from "./clockSync.types";
import { runSequentially } from "../shared/sequential";

/** Node clock with the page clock's formula (`performance.timeOrigin + performance.now()`). */
export function nodeMonotonicNow(): number {
  return performance.timeOrigin + performance.now();
}

/**
 * Offset of the round trip with the smallest round-trip time: the page read is assumed halfway
 * through it (`pageMs − (sentMs + receivedMs) / 2`). Undefined without samples.
 */
export function estimateClockOffset(samples: readonly ClockSyncSample[]): ClockOffset | undefined {
  let best: ClockOffset | undefined;
  for (const { sentMs, pageMs, receivedMs } of samples) {
    const rttMs = receivedMs - sentMs;
    if (best == undefined || rttMs < best.rttMs) {
      best = { rttMs, offsetMs: pageMs - (sentMs + receivedMs) / 2 };
    }
  }
  return best;
}

/** Page clock at Node time `nodeMs`. */
export function toPageClock(nodeMs: number, offset: Pick<ClockOffset, "offsetMs">): number {
  return nodeMs + offset.offsetMs;
}

/** Takes `rounds` sequential page clock round trips and estimates the Node → page offset. */
export async function syncPageClock({
  readPageNow,
  nodeNow,
  rounds,
}: SyncPageClockOptions): Promise<ClockOffset> {
  const samples: ClockSyncSample[] = [];
  await runSequentially(rounds, async () => {
    const sentMs = nodeNow();
    const pageMs = await readPageNow();
    samples.push({ sentMs, pageMs, receivedMs: nodeNow() });
  });
  const offset = estimateClockOffset(samples);
  if (offset == undefined) {
    throw new Error(`syncPageClock needs at least one round, got ${rounds}`);
  }
  return offset;
}
