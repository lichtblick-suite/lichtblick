// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time } from "@lichtblick/rostime";
import {
  IIterableSource,
  Initialization,
  IteratorResult,
} from "@lichtblick/suite-base/players/IterablePlayer/IIterableSource";
import type { ITelemetry } from "@lichtblick/suite-base/util/telemetry";

import type { HYDRATED_SOURCE_POOL_COUNTER_KEYS } from "./constants";

// Contract a caller supplies to HydratedSourcePool for a hydrated (heavyweight) value.
export type SourceHydrator<T> = {
  // Create the heavyweight value (open readable, build reader, parse channels, ...).
  open: () => Promise<T>;
  // Release the heavyweight value (close readable/connection, drop references).
  close: (value: T) => Promise<void>;
  // Optional estimated resident memory (bytes) of the hydrated value, used by the byte budget.
  // When omitted, every entry weighs 1 so the pool behaves as a pure count cap.
  weigh?: (value: T) => number;
};

export type HydratedSourcePoolOptions = {
  // Primary limiter: evict LRU unpinned entries while total estimated bytes exceeds this.
  maxBytes?: number;
  // Safety cap on resident entry count (bounds open connections/readers regardless of weight).
  maxCount?: number;
  // Never evict below this many entries (default 1), even when over the byte/count budget.
  minResident?: number;
  // Telemetry sink for pool metrics. Defaults to `getTelemetry()` of the realm the pool
  // is constructed in, evaluated once at construction. No-op (and zero-cost) unless enabled.
  telemetry?: ITelemetry;
  // Bounded identifier attached as the `poolId` label. Defaults to `pool-<n>` (module counter,
  // one per pool instance in the realm).
  poolId?: string;
  // Monotonic clock (ms) used for over-budget durations. Defaults to `monotonicNow` (tests inject).
  now?: () => number;
};

/**
 * Point-in-time snapshot of HydratedSourcePool bookkeeping (see `HydratedSourcePool.getStats()`).
 * Diagnostics and tests only, not a stable API.
 *
 * Gauges (current values): `residentCount`, `residentBytes`, `pinnedEntries`, `activePins`,
 * `overBudget`. Cumulative counters since construction: `acquires`, `releases`, `terminatedPins`,
 * `opens`, `rehydrations`, `admits`, `closes`, `evictions`, `failures`, `overBudgetPeriods`,
 * `overBudgetDurationMs`. High-water marks: `highWater*`.
 *
 * Invariant (holds at all times, including while hydrations are pending):
 * `acquires - releases - terminatedPins === activePins`.
 */
export type HydratedSourcePoolStats = {
  // Entries currently in the pool, including entries whose hydration is still pending.
  residentCount: number;
  // Sum of the estimated weights of resident, hydrated entries (pending entries weigh 0).
  residentBytes: number;
  // Resident entries with at least one pin.
  pinnedEntries: number;
  // Pins currently held (acquired and not yet released/rolled back/terminated).
  activePins: number;
  // Pins added by acquire() (resident hit or new hydration).
  acquires: number;
  // Pins removed by release() or by rolling back a failed acquire(). A release() of an unknown
  // token or of an entry with zero pins is not counted.
  releases: number;
  // Pins still outstanding when terminate() ran (dropped without a release).
  terminatedPins: number;
  // hydrator.open() calls.
  opens: number;
  // Subset of `opens` for tokens that had previously been evicted.
  rehydrations: number;
  // admit() calls that inserted a new entry (duplicates / post-terminate admits are not counted).
  admits: number;
  // Completed hydrator.close() calls (eviction, terminate, duplicate/late admit). A close that
  // rejects is not counted: eviction and terminate failures are logged, while admit() propagates
  // the rejection to its caller.
  closes: number;
  // Entries evicted by the LRU budget.
  evictions: number;
  // acquire() calls that rejected because hydration failed (counted per caller).
  failures: number;
  // True when, after an eviction pass, the pool is still above `maxCount` or `maxBytes` (pinned
  // entries or the `minResident` floor prevented further eviction).
  overBudget: boolean;
  // Number of times the pool entered the over-budget state.
  overBudgetPeriods: number;
  // Accumulated time spent over budget, including the currently open period.
  overBudgetDurationMs: number;
  highWaterResidentCount: number;
  highWaterResidentBytes: number;
  highWaterActivePins: number;
};

// Integer event counters of HydratedSourcePool kept as plain numbers (overBudgetDurationMs is
// derived separately). Derived from the dependency-free tuple in ./constants.
export type HydratedSourcePoolCounterKey = (typeof HYDRATED_SOURCE_POOL_COUNTER_KEYS)[number];

// Shared memory/concurrency overrides for a multi-file session. All optional; internal defaults
// apply when unset.
type MultiSourceHydrationOptions = {
  // Primary byte budget for resident heavyweight readers (worker memory). Overrides the internal
  // default when set. `maxHydratedSources` remains a count-cap safety on top of this.
  maxHydratedBytes?: number;
  // Maximum number of heavyweight per-file readers kept resident at once. Bounds worker memory for
  // large multi-file sessions; sources beyond this are re-opened on demand.
  maxHydratedSources?: number;
  // Maximum number of sources initialized concurrently. Bounds the transient memory spike from
  // concurrently parsing many MCAP channel schemas (and, for remote sources, the initial request
  // burst from concurrent MCAP summary reads).
  initConcurrency?: number;
};

export type MultiSource =
  | ({
      type: "files";
      files: Blob[];
    } & MultiSourceHydrationOptions)
  | ({
      type: "urls";
      urls: string[];
      totalCacheSizeInBytes?: number;
      minCachePerSourceBytes?: number;
      // When false, each remote source downloads only exact requested ranges with no speculative
      // read-ahead. When omitted, MultiIterableSource now defaults to read-ahead enabled and uses
      // readAheadBufferBytes to keep multi-file sessions safely bounded.
      readAheadEnabled?: boolean;
      // Bounds the speculative read-ahead extension (bytes) used when readAheadEnabled is true.
      // When omitted, MultiIterableSource derives a safe multi-file value from the per-source
      // cache budget, while single-file sessions keep the legacy 50 MiB default from
      // getNewConnection.ts.
      readAheadBufferBytes?: number;
    } & MultiSourceHydrationOptions);

export type IterableSourceConstructor<T extends IIterableSource, P> = new (args: P) => T;

export type InitMetadata = Initialization["metadata"];

export type InitTopicStatsMap = Initialization["topicStats"];

export type SourceWithTime = {
  source: IIterableSource;
  startTime: Time;
  endTime: Time;
};

export type SequentialIteratorMergeOptions<T extends IteratorResult> = {
  value: T;
  iterator: AsyncIterableIterator<Readonly<IteratorResult>>;
};
