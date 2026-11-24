// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/** One Node → page → Node clock round trip (all values epoch-anchored ms). */
export type ClockSyncSample = {
  /** Node clock right before the page call. */
  sentMs: number;
  /** Page clock read by the page call. */
  pageMs: number;
  /** Node clock right after the page call resolved. */
  receivedMs: number;
};

/** Page clock − Node clock, from the round trip with the smallest `rttMs`. */
export type ClockOffset = {
  offsetMs: number;
  /** Round trip of the chosen sample: the offset is exact to ±`rttMs` / 2. */
  rttMs: number;
};

export type SyncPageClockOptions = {
  /** Reads the page clock (one page round trip). */
  readPageNow: () => Promise<number>;
  /** Node clock, same epoch-anchored formula as the page clock. */
  nodeNow: () => number;
  /** Round trips to take (≥ 1). */
  rounds: number;
};
