// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// Types of the in-process toggle A/B (`runner/toggleBlocks.ts`, `runner/toggleWindow.ts`).
// Type-only: also read by the report and the CI summary through `overhead.types.ts`.

import type { SamplingClock } from "./steadyWindow.types";
import type { MainThreadProfileCapture } from "../result/directAttribution.types";
import type { MetricStats, Verdict } from "../result/stats.types";

/** Telemetry state of a toggle block: off = no-op realm sink + collectors paused, on = restored. */
export type ToggleArm = "off" | "on";

/** Cumulative CPU time of one process (CDP `cpuTime` / Electron `cpu.cumulativeCPUUsage`). */
export type CumulativeCpuReading = {
  pid: number;
  /** Cross-platform process type (`mapCdpProcessType` / `mapElectronProcessType`). */
  processType: string;
  /** CPU seconds since the process started. */
  cpuTimeSec: number;
};

/** Process type → number of processes. */
export type ProcessSet = Record<string, number>;

/** CPU of one block from two cumulative readings (`blockCpu`). */
export type BlockCpu = {
  /** Δ CPU seconds / Δ wall of the processes present at both readings; per-core sum (100 = 1 core). */
  cpuPercent: number;
  /** Types and counts of the processes present at both readings. */
  processSet: ProcessSet;
  /** `cpuPercent` split by process type (same processes, same unit); attributes an arm delta. */
  cpuPercentByProcessType: Record<string, number>;
  /** A process appeared or exited between the readings (its CPU is not counted). */
  processSetChanged: boolean;
};

/**
 * Why a block's quartet (and pair) is excluded: `processSetChanged` (a process appeared/exited
 * during the block) or `processSetNotModal` (its process set differs from the run's most frequent
 * one).
 */
export type ToggleBlockFlag = "processSetChanged" | "processSetNotModal";

/** One measured block as recorded by the sampler (before the run-level flags). */
export type ToggleBlockRecording = {
  /** Block position (0-based); quartet = `Math.floor(index / 4)`, pair = `Math.floor(index / 2)`. */
  index: number;
  arm: ToggleArm;
  /** Page-clock bounds of the measured part (after the settle period). */
  startMonotonicTs: number;
  endMonotonicTs: number;
  /** Wall time between the two CPU readings (midpoints of the reads), ms. */
  measuredMs: number;
  cpu: BlockCpu;
  /** Round trip of the block's `setTelemetryActive` call, ms. */
  toggleLatencyMs: number;
  /** The toggle plus the CPU read did not fit in the settle period (the block started late). */
  lateStart: boolean;
  /** UA memory calls during the block (difference of the cumulative page counts). */
  uaCalls: number;
};

/** A block of the report: the recording plus its records and flags. */
export type ToggleBlockV3 = Omit<ToggleBlockRecording, "cpu"> & {
  cpuPercent: number;
  processSet: ProcessSet;
  /** `cpuPercent` per process type (absent in reports written before it existed). */
  cpuPercentByProcessType?: Record<string, number>;
  /** Drained telemetry records stamped inside the measured part, per realm. */
  recordsByRealm: Record<string, number>;
  flags: ToggleBlockFlag[];
};

/** Why a quartet or pair is excluded: one of its off / on blocks has a `ToggleBlockFlag`. */
export type ToggleExclusionReason = "offBlockFlagged" | "onBlockFlagged";

/**
 * Four consecutive blocks `4k … 4k + 3` in mirrored order (`off-on-on-off` or `on-off-off-on`):
 * the statistical unit of the toggle A/B. Both arms have the same mean block time, so a linear
 * CPU drift over the quartet cancels out of its deltas.
 */
export type ToggleQuartetV3 = {
  index: number;
  order: "off-on-on-off" | "on-off-off-on";
  /** Block indices of the two off / on blocks. */
  offBlocks: [number, number];
  onBlocks: [number, number];
  /**
   * CPU of each arm over its two blocks: Σ Δ CPU seconds / Σ Δ wall (the blocks' CPU weighted by
   * their measured wall time), per-core sum (100 = one core).
   */
  offCpuPercent: number;
  onCpuPercent: number;
  /** `on / off − 1` of the arm CPU; undefined for a 0 baseline. */
  cpuRelative?: number;
  /** On − off arm CPU, percentage points (100 = one core). */
  cpuPctPoints: number;
  excluded: boolean;
  reasons: ToggleExclusionReason[];
};

/**
 * Adjacent off/on blocks (`2k`, `2k + 1`) and their deltas (on − off). Diagnostic only (not part
 * of the statistics or verdict): a drift over the run biases every pair, alternating in sign.
 */
export type TogglePairV3 = {
  index: number;
  order: "off-first" | "on-first";
  offBlock: number;
  onBlock: number;
  /** `(on − off) / off` of the block CPU; undefined for a 0 baseline. */
  cpuRelative?: number;
  /** On − off block CPU, percentage points (100 = one core). */
  cpuPctPoints: number;
  excluded: boolean;
  reasons: ToggleExclusionReason[];
};

export type ToggleConfigV3 = {
  /** Requested ABBA quartets, 4 blocks each (`BENCHMARK_OVERHEAD_TOGGLE_QUARTETS`). */
  quartets: number;
  /** Block length incl. the settle period (`BENCHMARK_OVERHEAD_TOGGLE_BLOCK_MS`). */
  blockMs: number;
  /** Start of each block excluded from the measurement (toggle call + settling). */
  settleMs: number;
  /** Telemetry-on warm-up before the first block. */
  warmupMs: number;
  /** Drain loop cadence (runs through all blocks). */
  drainIntervalMs: number;
};

/** Per-process-type CPU delta of a toggle A/B (`toggleProcessTypeDeltas`). */
export type ToggleProcessTypeDelta = {
  processType: string;
  /** Mean over the included quartets of the on − off arm CPU of this process type, pp. */
  meanPctPoints: number;
  /** Included quartets with a positive delta for this process type. */
  positiveQuartets: number;
  /** Included quartets. */
  quartets: number;
};

/** The toggle A/B of one scenario run (one app launch). */
export type OverheadToggleSummaryV3 = {
  method: "toggle";
  config: ToggleConfigV3;
  /** Included quartets (the statistical unit). */
  n: number;
  /** Quartets with a flagged block. */
  excludedQuartets: number;
  /** Median / IQR / bootstrap CI95 of the included quartets' deltas. */
  metrics: { cpuRelative: MetricStats; cpuPctPoints: MetricStats };
  /** `cpuRelative` CI95 against `cpuDeltaRelativeMax`. */
  verdict: Verdict;
  /** Most frequent process set of the blocks. */
  modalProcessSet: ProcessSet;
  /** Blocks with any `ToggleBlockFlag`. */
  flaggedBlocks: number;
  /** Blocks whose toggle plus CPU read overran the settle period. */
  lateStartBlocks: number;
  toggleLatencyMsMax: number;
  /** UA memory calls in the on / off blocks (off should be 0). */
  uaCalls: { onBlocks: number; offBlocks: number };
  /** Renderer-realm records stamped in the on / off blocks (off should be ≈ 0). */
  rendererRecords: { onBlocks: number; offBlocks: number };
  /** Wall time of the whole run (launch to close), ms. */
  runDurationMs?: number;
  blocks: ToggleBlockV3[];
  quartets: ToggleQuartetV3[];
  /** Adjacent-pair deltas, diagnostic only (see `TogglePairV3`). */
  pairs: TogglePairV3[];
};

/** Options of `sampleToggleWindow` (I/O injected). */
export type ToggleWindowSamplingOptions = {
  /** Page clock "now" without a page call (Node clock + measured offset). */
  stamp: () => number;
  /** `setTelemetryActive` for `arm` (page call; serialized with the drains). */
  setActive: (arm: ToggleArm) => Promise<{ uaCalls: number }>;
  /** Cumulative CPU of the app's processes (no page call). */
  readCpu: () => Promise<CumulativeCpuReading[]>;
  /** One telemetry drain (page call). */
  drain: () => Promise<void>;
  arms: readonly ToggleArm[];
  warmupMs: number;
  blockMs: number;
  settleMs: number;
  drainIntervalMs: number;
  clock: SamplingClock;
  /**
   * Profiled period after the last block, with telemetry back on and the drains still running
   * (direct CPU attribution); skipped when absent.
   */
  profile?: () => Promise<MainThreadProfileCapture>;
};

/** What `sampleToggleWindow` observed. */
export type ToggleWindowRecording = {
  blocks: ToggleBlockRecording[];
  /** UA memory calls during the warm-up (cumulative count at the first toggle). */
  warmupUaCalls: number;
  /** Outcome of `ToggleWindowSamplingOptions.profile` (when given). */
  profile?: MainThreadProfileCapture;
};
