// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import type { MainThreadProbeReading } from "../result/steadyWindow.types";

/** Wall clock and sleep of the steady sampling loops (injectable for tests). */
export type SamplingClock = {
  now(): number;
  /** Resolves after `ms`, or as soon as `signal` aborts. */
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
};

export type SteadyWindowSamplingOptions = {
  /** Page clock "now" without a page call (Node clock + measured offset, see `runner/clockSync.ts`). */
  stamp: () => number;
  /** One host poll (no page call), stamped with `monotonicTs`. */
  poll: (monotonicTs: number) => Promise<void>;
  /** One telemetry drain (page call); run by the drain loop, never by the poll schedule. */
  drain: () => Promise<void>;
  /** Reads the main-thread probe (page call; undefined when unavailable). */
  readProbe: () => Promise<MainThreadProbeReading | undefined>;
  warmupMs: number;
  polls: number;
  intervalMs: number;
  drainIntervalMs: number;
  clock: SamplingClock;
};

/** A running drain loop (`startDrainLoop`). */
export type DrainLoop = {
  /** Lets an in-flight drain finish, starts no further one; rejects with a drain's failure. */
  stop(): Promise<void>;
};

/** What `sampleSteadyWindow` observed (input of `summarizeSteadyWindow`). */
export type SteadyWindowRecording = {
  /** Page clock of each steady poll (the priming poll excluded). */
  pollTimestamps: number[];
  overruns: number;
  /** Longest host poll (priming and steady polls), wall-clock ms. */
  maxPollLatencyMs: number;
  /** Round trip of the clock sync that stamped the polls (set by the runner). */
  clockSyncRttMs?: number;
  /** Page clock of the priming poll. */
  startMonotonicTs: number;
  /** Page clock of the last steady poll. */
  endMonotonicTs: number;
  mainThreadStart?: MainThreadProbeReading;
  mainThreadEnd?: MainThreadProbeReading;
};
