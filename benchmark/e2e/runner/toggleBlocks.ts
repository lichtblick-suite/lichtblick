// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// In-process toggle A/B (pure part): one app instance with telemetry installed on, switched off and
// on in-page (`window.lichtblickTelemetry.setTelemetryActive`) in ABBA blocks. Each block's CPU is
// the cumulative process CPU time read after the block's settle period and at its end:
// `Δ cpu seconds / Δ wall` summed over the processes present at both reads (per-core sum, 100 = one
// core, as `runner/hostCpus.ts`), never an instantaneous or decayed percentage.
//
// The statistical unit is the ABBA quartet (blocks `4k … 4k + 3`, off-on-on-off): both arms have
// the same mean block time, so a linear CPU drift over the quartet (warm-up tail, thermal state,
// a growing heap) cancels out of `Σ on / Σ off − 1`, where adjacent off/on pairs would each pick it
// up with alternating sign. Quartets with a block whose process set changed or differs from the
// run's modal set are excluded. The included quartets feed the same statistics (median, IQR,
// exact order-statistic CI95) and verdict as the relaunch A/B; adjacent-pair deltas are kept as a
// diagnostic.
//
// Caveat: all quartets of a run share one process, so GC, cache and thermal state carry over and
// they may not be fully independent. The CI assumes independent quartets and is optimistic under
// positive autocorrelation, so read a borderline `within` with care. In the 10-quartet evidence
// runs the lag-1 autocorrelation of the quartet deltas was −0.33 … +0.46 (no clear dependence,
// little power at that n); the relaunch A/B (a fresh launch per run) is the independent check.

import type {
  BlockCpu,
  CumulativeCpuReading,
  OverheadToggleSummaryV3,
  ProcessSet,
  ToggleArm,
  ToggleBlockFlag,
  ToggleBlockRecording,
  ToggleBlockV3,
  ToggleConfigV3,
  ToggleExclusionReason,
  TogglePairV3,
  ToggleProcessTypeDelta,
  ToggleQuartetV3,
} from "./toggleBlocks.types";
import { MIN_QUARTETS_FOR_VERDICT, MS_PER_SECOND } from "../result/constants";
import type { TelemetryRecord } from "../result/schemaV1";
import { summarizeMetric, verdict } from "../result/stats";
import { compareCodeUnits } from "../shared/compare";

/** CPU percent of one fully busy core. */
const PERCENT_PER_CORE = 100;

/** Realm of the page's own records (`installBenchmarkTelemetry`). */
const RENDERER_REALM = "renderer";

/** Arm order of every scheduled quartet. */
const QUARTET_ARMS: readonly ToggleArm[] = ["off", "on", "on", "off"];

/** Blocks per quartet. */
export const BLOCKS_PER_QUARTET = QUARTET_ARMS.length;

/**
 * Block arms of `quartets` complete ABBA quartets: off, on, on, off, off, on, on, off, … (quartet
 * `k` = blocks `4k … 4k + 3`). Every quartet has the same orientation, so in each one arm switch
 * precedes one block of either arm (the off → on and on → off settling costs are balanced).
 */
export function toggleBlockArms(quartets: number): ToggleArm[] {
  const arms: ToggleArm[] = [];
  for (let quartet = 0; quartet < quartets; quartet++) {
    arms.push(...QUARTET_ARMS);
  }
  return arms;
}

/** Process type → count of `readings`. */
function processSetOf(readings: readonly CumulativeCpuReading[]): ProcessSet {
  const set: ProcessSet = {};
  for (const reading of readings) {
    set[reading.processType] = (set[reading.processType] ?? 0) + 1;
  }
  return set;
}

/**
 * CPU of one block from the cumulative readings at its measured start and end, `wallMs` apart:
 * Δ CPU seconds of the processes present at both reads × 1000 × 100 / `wallMs` (per-core sum). A
 * negative per-process delta (pid reuse) counts as 0. Processes present at only one read are left
 * out and flag `processSetChanged`.
 */
export function blockCpu(
  start: readonly CumulativeCpuReading[],
  end: readonly CumulativeCpuReading[],
  wallMs: number,
): BlockCpu {
  if (Number.isNaN(wallMs) || wallMs <= 0) {
    throw new Error(`Toggle block wall time must be positive (got ${wallMs} ms)`);
  }
  const startByPid = new Map(start.map((reading) => [reading.pid, reading]));
  const common: CumulativeCpuReading[] = [];
  const cpuSecByProcessType: Record<string, number> = {};
  let cpuSec = 0;
  for (const reading of end) {
    const before = startByPid.get(reading.pid);
    if (before != undefined) {
      common.push(reading);
      const deltaSec = Math.max(0, reading.cpuTimeSec - before.cpuTimeSec);
      cpuSec += deltaSec;
      cpuSecByProcessType[reading.processType] =
        (cpuSecByProcessType[reading.processType] ?? 0) + deltaSec;
    }
  }
  const toPercent = (sec: number) => (sec * MS_PER_SECOND * PERCENT_PER_CORE) / wallMs;
  const cpuPercentByProcessType: Record<string, number> = {};
  for (const [processType, sec] of Object.entries(cpuSecByProcessType)) {
    cpuPercentByProcessType[processType] = toPercent(sec);
  }
  return {
    cpuPercent: toPercent(cpuSec),
    cpuPercentByProcessType,
    processSet: processSetOf(common),
    processSetChanged: common.length !== start.length || common.length !== end.length,
  };
}

/** Stable key of a process set (`browser:1,gpu:1,renderer:2`). */
export function processSetKey(set: ProcessSet): string {
  return Object.keys(set)
    .sort(compareCodeUnits)
    .map((type) => `${type}:${set[type]}`)
    .join(",");
}

/** The most frequent process set of `sets` (ties: the earliest); `{}` without sets. */
export function modalProcessSet(sets: readonly ProcessSet[]): ProcessSet {
  const counts = new Map<string, { set: ProcessSet; count: number }>();
  let modal: { set: ProcessSet; count: number } | undefined;
  for (const set of sets) {
    const key = processSetKey(set);
    const entry = counts.get(key) ?? { set, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
    if (modal == undefined || entry.count > modal.count) {
      modal = entry;
    }
  }
  return modal?.set ?? {};
}

/** Records per realm stamped within `[startTs, endTs]`. */
export function recordsByRealmIn(
  records: readonly Pick<TelemetryRecord, "realm" | "monotonicTs">[],
  startTs: number,
  endTs: number,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    if (record.monotonicTs >= startTs && record.monotonicTs <= endTs) {
      counts[record.realm] = (counts[record.realm] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Report blocks of a recording: CPU and process set flattened, the records stamped inside each
 * block, and the flags against the run's modal process set.
 */
export function buildToggleBlocks(
  recordings: readonly ToggleBlockRecording[],
  records: readonly Pick<TelemetryRecord, "realm" | "monotonicTs">[],
): { blocks: ToggleBlockV3[]; modalProcessSet: ProcessSet } {
  const modal = modalProcessSet(recordings.map((block) => block.cpu.processSet));
  const modalKey = processSetKey(modal);
  const blocks = recordings.map(({ cpu, ...block }): ToggleBlockV3 => {
    const flags: ToggleBlockFlag[] = [];
    if (cpu.processSetChanged) {
      flags.push("processSetChanged");
    }
    if (processSetKey(cpu.processSet) !== modalKey) {
      flags.push("processSetNotModal");
    }
    return {
      ...block,
      cpuPercent: cpu.cpuPercent,
      processSet: cpu.processSet,
      cpuPercentByProcessType: cpu.cpuPercentByProcessType,
      recordsByRealm: recordsByRealmIn(records, block.startMonotonicTs, block.endMonotonicTs),
      flags,
    };
  });
  return { blocks, modalProcessSet: modal };
}

/** `(on − off) / off`; 0 when both are 0, undefined for a 0 baseline only. */
function relativeDelta(off: number, on: number): number | undefined {
  if (off > 0) {
    return (on - off) / off;
  }
  return on <= 0 ? 0 : undefined;
}

/** Exclusion reasons of a group of off / on blocks (one per arm with a flagged block). */
function exclusionReasons(
  offBlocks: readonly ToggleBlockV3[],
  onBlocks: readonly ToggleBlockV3[],
): ToggleExclusionReason[] {
  const reasons: ToggleExclusionReason[] = [];
  if (offBlocks.some((block) => block.flags.length > 0)) {
    reasons.push("offBlockFlagged");
  }
  if (onBlocks.some((block) => block.flags.length > 0)) {
    reasons.push("onBlockFlagged");
  }
  return reasons;
}

/**
 * Pairs of adjacent blocks (`2k`, `2k + 1`, one off and one on); a trailing unpaired block or a
 * pair without both arms is skipped. A pair with a flagged block is excluded. Diagnostic only: the
 * statistics use the quartets (`buildToggleQuartets`).
 */
export function buildTogglePairs(blocks: readonly ToggleBlockV3[]): TogglePairV3[] {
  const pairs: TogglePairV3[] = [];
  for (let index = 0; index + 1 < blocks.length; index += 2) {
    const first = blocks[index]!;
    const second = blocks[index + 1]!;
    const off = first.arm === "off" ? first : second;
    const on = first.arm === "on" ? first : second;
    if (off.arm !== "off" || on.arm !== "on") {
      continue;
    }
    const reasons = exclusionReasons([off], [on]);
    const cpuRelative = relativeDelta(off.cpuPercent, on.cpuPercent);
    pairs.push({
      index: index / 2,
      order: first.arm === "off" ? "off-first" : "on-first",
      offBlock: off.index,
      onBlock: on.index,
      ...(cpuRelative != undefined && { cpuRelative }),
      cpuPctPoints: on.cpuPercent - off.cpuPercent,
      excluded: reasons.length > 0,
      reasons,
    });
  }
  return pairs;
}

/** CPU of `blocks` together: Σ Δ CPU seconds / Σ Δ wall (block CPU weighted by measured wall). */
function pooledCpuPercent(blocks: readonly ToggleBlockV3[]): number {
  let weighted = 0;
  let wallMs = 0;
  for (const block of blocks) {
    weighted += block.cpuPercent * block.measuredMs;
    wallMs += block.measuredMs;
  }
  return wallMs > 0 ? weighted / wallMs : 0;
}

/**
 * ABBA quartets of blocks `4k … 4k + 3` in mirrored order (`off-on-on-off` / `on-off-off-on`);
 * an incomplete trailing group or a group in any other order is skipped. Deltas compare the arms'
 * pooled CPU (`Σ on / Σ off − 1`, on − off pp), which cancels a linear drift over the quartet. A
 * quartet with a flagged block is excluded.
 */
export function buildToggleQuartets(blocks: readonly ToggleBlockV3[]): ToggleQuartetV3[] {
  const quartets: ToggleQuartetV3[] = [];
  for (let start = 0; start + BLOCKS_PER_QUARTET <= blocks.length; start += BLOCKS_PER_QUARTET) {
    const [a, b, c, d] = blocks.slice(start, start + BLOCKS_PER_QUARTET) as [
      ToggleBlockV3,
      ToggleBlockV3,
      ToggleBlockV3,
      ToggleBlockV3,
    ];
    if (a.arm === b.arm || a.arm !== d.arm || b.arm !== c.arm) {
      continue;
    }
    const [off, on] =
      a.arm === "off"
        ? [
            [a, d],
            [b, c],
          ]
        : [
            [b, c],
            [a, d],
          ];
    const offCpuPercent = pooledCpuPercent(off);
    const onCpuPercent = pooledCpuPercent(on);
    const reasons = exclusionReasons(off, on);
    const cpuRelative = relativeDelta(offCpuPercent, onCpuPercent);
    quartets.push({
      index: start / BLOCKS_PER_QUARTET,
      order: a.arm === "off" ? "off-on-on-off" : "on-off-off-on",
      offBlocks: [off[0]!.index, off[1]!.index],
      onBlocks: [on[0]!.index, on[1]!.index],
      offCpuPercent,
      onCpuPercent,
      ...(cpuRelative != undefined && { cpuRelative }),
      cpuPctPoints: onCpuPercent - offCpuPercent,
      excluded: reasons.length > 0,
      reasons,
    });
  }
  return quartets;
}

function sumOver(
  blocks: readonly ToggleBlockV3[],
  arm: ToggleArm,
  pick: (block: ToggleBlockV3) => number,
): number {
  return blocks.filter((block) => block.arm === arm).reduce((sum, block) => sum + pick(block), 0);
}

/**
 * The toggle section of the overhead report from its report blocks (`buildToggleBlocks`): quartets,
 * median / IQR / exact order-statistic CI95 of the included quartets' deltas, the CPU verdict against
 * `cpuDeltaRelativeMax` (`inconclusive` below `MIN_QUARTETS_FOR_VERDICT` included quartets), and
 * the adjacent pairs as a diagnostic.
 */
function summarizeToggleBlocks({
  blocks,
  modalProcessSet: modal,
  config,
  cpuDeltaRelativeMax,
  runDurationMs,
}: {
  blocks: readonly ToggleBlockV3[];
  modalProcessSet: ProcessSet;
  config: ToggleConfigV3;
  cpuDeltaRelativeMax: number;
  runDurationMs?: number;
}): OverheadToggleSummaryV3 {
  const quartets = buildToggleQuartets(blocks);
  const included = quartets.filter((quartet) => !quartet.excluded);
  const cpuRelative = summarizeMetric(included.map((quartet) => quartet.cpuRelative));
  const cpuPctPoints = summarizeMetric(included.map((quartet) => quartet.cpuPctPoints));
  const rendererRecords = (block: ToggleBlockV3) => block.recordsByRealm[RENDERER_REALM] ?? 0;
  return {
    method: "toggle",
    config,
    n: included.length,
    excludedQuartets: quartets.length - included.length,
    metrics: { cpuRelative, cpuPctPoints },
    verdict: verdict(
      cpuRelative.ci95,
      cpuDeltaRelativeMax,
      cpuRelative.n,
      MIN_QUARTETS_FOR_VERDICT,
    ),
    modalProcessSet: modal,
    flaggedBlocks: blocks.filter((block) => block.flags.length > 0).length,
    lateStartBlocks: blocks.filter((block) => block.lateStart).length,
    toggleLatencyMsMax: Math.max(0, ...blocks.map((block) => block.toggleLatencyMs)),
    uaCalls: {
      onBlocks: sumOver(blocks, "on", (block) => block.uaCalls),
      offBlocks: sumOver(blocks, "off", (block) => block.uaCalls),
    },
    rendererRecords: {
      onBlocks: sumOver(blocks, "on", rendererRecords),
      offBlocks: sumOver(blocks, "off", rendererRecords),
    },
    ...(runDurationMs != undefined && { runDurationMs }),
    blocks: [...blocks],
    quartets,
    pairs: buildTogglePairs(blocks),
  };
}

/** The toggle section of the overhead report from the sampler's recordings (`summarizeToggleBlocks`). */
export function summarizeToggle({
  recordings,
  records,
  ...options
}: {
  recordings: readonly ToggleBlockRecording[];
  records: readonly Pick<TelemetryRecord, "realm" | "monotonicTs">[];
  config: ToggleConfigV3;
  cpuDeltaRelativeMax: number;
  runDurationMs?: number;
}): OverheadToggleSummaryV3 {
  return summarizeToggleBlocks({ ...buildToggleBlocks(recordings, records), ...options });
}

/** CPU of one process type over `blocks` (pooled like `pooledCpuPercent`, absent type = 0). */
function pooledProcessTypeCpuPercent(
  blocks: readonly ToggleBlockV3[],
  processType: string,
): number {
  let weighted = 0;
  let wallMs = 0;
  for (const block of blocks) {
    weighted += (block.cpuPercentByProcessType?.[processType] ?? 0) * block.measuredMs;
    wallMs += block.measuredMs;
  }
  return wallMs > 0 ? weighted / wallMs : 0;
}

/**
 * Where a toggle A/B's CPU delta lands: per process type, the mean on − off pp of its pooled arm
 * CPU over the included quartets and how many quartets were positive, largest |mean| first.
 * Descriptive (no CI); empty without an included quartet or for blocks without the per-type split
 * (reports written before it existed).
 */
export function toggleProcessTypeDeltas(
  toggle: Pick<OverheadToggleSummaryV3, "blocks" | "quartets">,
): ToggleProcessTypeDelta[] {
  const byIndex = new Map(toggle.blocks.map((block) => [block.index, block]));
  const splitBlocks = (indexes: readonly number[]): ToggleBlockV3[] | undefined => {
    const found = indexes.flatMap((index) => {
      const block = byIndex.get(index);
      return block?.cpuPercentByProcessType != undefined ? [block] : [];
    });
    return found.length === indexes.length ? found : undefined;
  };
  const arms: { off: ToggleBlockV3[]; on: ToggleBlockV3[] }[] = [];
  for (const quartet of toggle.quartets.filter((entry) => !entry.excluded)) {
    const off = splitBlocks(quartet.offBlocks);
    const on = splitBlocks(quartet.onBlocks);
    if (off == undefined || on == undefined) {
      return [];
    }
    arms.push({ off, on });
  }
  if (arms.length === 0) {
    return [];
  }
  const processTypes = new Set(
    arms.flatMap(({ off, on }) =>
      [...off, ...on].flatMap((block) => Object.keys(block.cpuPercentByProcessType ?? {})),
    ),
  );
  const deltas = [...processTypes].map((processType) => {
    const perQuartet = arms.map(
      ({ off, on }) =>
        pooledProcessTypeCpuPercent(on, processType) -
        pooledProcessTypeCpuPercent(off, processType),
    );
    return {
      processType,
      meanPctPoints: perQuartet.reduce((sum, value) => sum + value, 0) / perQuartet.length,
      positiveQuartets: perQuartet.filter((value) => value > 0).length,
      quartets: perQuartet.length,
    };
  });
  return deltas.sort((a, b) => Math.abs(b.meanPctPoints) - Math.abs(a.meanPctPoints));
}

/**
 * Mean off-arm CPU of the included quartets (per-core sum, 100 = one core): the baseline the direct
 * CPU attribution relates its telemetry time to. Undefined without an included quartet.
 */
export function toggleOffCpuPercent(
  quartets: readonly Pick<ToggleQuartetV3, "offCpuPercent" | "excluded">[],
): number | undefined {
  const included = quartets.filter((quartet) => !quartet.excluded);
  if (included.length === 0) {
    return undefined;
  }
  return included.reduce((sum, quartet) => sum + quartet.offCpuPercent, 0) / included.length;
}

/**
 * Page auto-pause (`?scenario.durationMs=`) and MCAP fixture span of a toggle run of `blocks`
 * blocks: warm-up, every block, the profiled period after them (`profileMs`, default 0), plus
 * `marginMs`, so data keeps flowing until the measurement ends.
 */
export function toggleScenarioDurationMs({
  warmupMs,
  blocks,
  blockMs,
  profileMs = 0,
  marginMs,
}: {
  warmupMs: number;
  blocks: number;
  blockMs: number;
  profileMs?: number;
  marginMs: number;
}): number {
  return warmupMs + blocks * blockMs + profileMs + marginMs;
}
