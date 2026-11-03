// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { OVERHEAD_TARGETS } from "../constants";
import { BLOCKS_PER_QUARTET, summarizeToggle, toggleBlockArms } from "../toggleBlocks";
import type {
  CumulativeCpuReading,
  OverheadToggleSummaryV3,
  ProcessSet,
  ToggleArm,
  ToggleBlockRecording,
  ToggleConfigV3,
} from "../toggleBlocks.types";

/** Default process set of a block: one browser, one GPU and one renderer process. */
const DEFAULT_PROCESS_SET: ProcessSet = { browser: 1, gpu: 1, renderer: 1 };

export type ToggleRecordingProps = {
  index: number;
  arm: ToggleArm;
  /** Block CPU, percent (default 100 off / 101 on). */
  cpuPercent?: number;
  processSet?: ProcessSet;
  /** Block CPU per process type (default `{}`). */
  cpuPercentByProcessType?: Record<string, number>;
  processSetChanged?: boolean;
  /** Measured part of the block: `[startMonotonicTs, startMonotonicTs + measuredMs]`. */
  startMonotonicTs?: number;
  measuredMs?: number;
  toggleLatencyMs?: number;
  lateStart?: boolean;
  uaCalls?: number;
};

/** CPU percent of the off and on blocks of one quartet (both blocks of an arm alike). */
export type ToggleArmCpu = { off: number; on: number };

/** Deterministic toggle A/B readings, block recordings and summaries. */
// Builder pattern uses static-only classes (same as packages/suite-base/src/testing/builders).
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class ToggleBlockBuilder {
  public static config(overrides: Partial<ToggleConfigV3> = {}): ToggleConfigV3 {
    return {
      quartets: 5,
      blockMs: 3000,
      settleMs: 500,
      warmupMs: 3000,
      drainIntervalMs: 2000,
      ...overrides,
    };
  }

  /**
   * Cumulative readings of one process per entry of `processSet` (pids from `firstPid`), each at
   * `cpuTimeSec`.
   */
  public static readings(
    cpuTimeSec: number,
    processSet: ProcessSet = DEFAULT_PROCESS_SET,
    firstPid = 100,
  ): CumulativeCpuReading[] {
    const readings: CumulativeCpuReading[] = [];
    for (const [processType, count] of Object.entries(processSet)) {
      for (let index = 0; index < count; index++) {
        readings.push({ pid: firstPid + readings.length, processType, cpuTimeSec });
      }
    }
    return readings;
  }

  /** One block recording; the measured part starts 500 ms into a 3 s block by default. */
  public static recording(props: ToggleRecordingProps): ToggleBlockRecording {
    const measuredMs = props.measuredMs ?? 2500;
    const startMonotonicTs = props.startMonotonicTs ?? 1000 + props.index * 3000 + 500;
    return {
      index: props.index,
      arm: props.arm,
      startMonotonicTs,
      endMonotonicTs: startMonotonicTs + measuredMs,
      measuredMs,
      cpu: {
        cpuPercent: props.cpuPercent ?? (props.arm === "on" ? 101 : 100),
        processSet: props.processSet ?? DEFAULT_PROCESS_SET,
        cpuPercentByProcessType: props.cpuPercentByProcessType ?? {},
        processSetChanged: props.processSetChanged ?? false,
      },
      toggleLatencyMs: props.toggleLatencyMs ?? 5,
      lateStart: props.lateStart ?? false,
      uaCalls: props.uaCalls ?? 0,
    };
  }

  /**
   * Recordings of `quartets.length` ABBA quartets (`toggleBlockArms`), block CPU from the quartet's
   * `off` / `on` value; `overrides(index)` adjusts single blocks.
   */
  public static abba(
    quartets: readonly ToggleArmCpu[],
    overrides: (index: number) => Partial<ToggleRecordingProps> = () => ({}),
  ): ToggleBlockRecording[] {
    return toggleBlockArms(quartets.length).map((arm, index) =>
      ToggleBlockBuilder.recording({
        index,
        arm,
        cpuPercent: quartets[Math.floor(index / BLOCKS_PER_QUARTET)]![arm],
        ...overrides(index),
      }),
    );
  }

  /**
   * Recordings with one CPU value per block (`cpuPercents[index]`), arms in ABBA order
   * (`toggleBlockArms`, a trailing partial quartet allowed); `overrides(index)` adjusts single
   * blocks.
   */
  public static fromBlockCpu(
    cpuPercents: readonly number[],
    overrides: (index: number) => Partial<ToggleRecordingProps> = () => ({}),
  ): ToggleBlockRecording[] {
    const arms = toggleBlockArms(Math.ceil(cpuPercents.length / BLOCKS_PER_QUARTET));
    return cpuPercents.map((cpuPercent, index) =>
      ToggleBlockBuilder.recording({ index, arm: arms[index]!, cpuPercent, ...overrides(index) }),
    );
  }

  /**
   * `summary` as written before the ABBA quartets (JSON): no `quartets` / `excludedQuartets`,
   * statistics over the adjacent pairs, `config.pairs` (two per quartet).
   */
  public static preQuartetSection(summary: OverheadToggleSummaryV3): Record<string, unknown> {
    const { quartets: _quartets, excludedQuartets, config, ...rest } = summary;
    const { quartets, ...settings } = config;
    return {
      ...rest,
      excludedPairs: excludedQuartets * 2,
      config: { ...settings, pairs: quartets * 2 },
    };
  }

  /**
   * Block overrides giving every block of an arm the per-process-type CPU `split[arm]` (for
   * `abba` / `summary`).
   */
  public static processSplit(
    split: Record<ToggleArm, Record<string, number>>,
    quartets: number,
  ): (index: number) => Partial<ToggleRecordingProps> {
    const arms = toggleBlockArms(quartets);
    return (index) => ({ cpuPercentByProcessType: split[arms[index]!] });
  }

  /**
   * A toggle summary of `quartets` identical quartets (default 6 × 100 % → 101 %, i.e. +1 %);
   * `overrides(index)` adjusts single blocks.
   */
  public static summary(
    quartets: readonly ToggleArmCpu[] = Array.from({ length: 6 }, () => ({ off: 100, on: 101 })),
    overrides?: (index: number) => Partial<ToggleRecordingProps>,
  ): OverheadToggleSummaryV3 {
    return summarizeToggle({
      recordings: ToggleBlockBuilder.abba(quartets, overrides),
      records: [],
      config: ToggleBlockBuilder.config({ quartets: quartets.length }),
      cpuDeltaRelativeMax: OVERHEAD_TARGETS.cpuDeltaRelativeMax,
    });
  }
}
