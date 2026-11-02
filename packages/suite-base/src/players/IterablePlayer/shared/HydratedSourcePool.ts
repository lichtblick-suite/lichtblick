// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Logger from "@lichtblick/log";
import {
  getTelemetry,
  monotonicNow,
  type ITelemetry,
  type TelemetryLabels,
} from "@lichtblick/suite-base/util/telemetry";

import type { PoolCounters } from "./HydratedSourcePool.types";
import {
  HYDRATED_SOURCE_POOL_COUNTER_KEYS,
  HYDRATED_SOURCE_POOL_COUNTER_METRICS,
  HYDRATED_SOURCE_POOL_GAUGE_METRICS,
  HYDRATED_SOURCE_POOL_OVER_BUDGET_DURATION_METRIC,
} from "./constants";
import type { HydratedSourcePoolOptions, HydratedSourcePoolStats, SourceHydrator } from "./types";

// Re-exported so the existing external import of this type from "./HydratedSourcePool" keeps
// working; its canonical definition now lives in shared/types.ts. HydratedSourcePoolOptions is
// only used internally here (constructor parameter type) — external consumers import it directly
// from "./types".
export type { SourceHydrator };

const log = Logger.getLogger(__filename);

// Ordinal for default `poolId` labels (`pool-<n>`). Only advanced for pools constructed while
// telemetry is enabled, so cardinality is one series per such pool in this realm.
// It is intentionally monotonic (never reused/reset): each pool instance gets a unique `poolId` in
// the telemetry timeline, so a re-initialised source's pool is never conflated with its
// predecessor. The number of distinct ids is bounded by the source re-initialisations in one
// benchmark run; telemetry is benchmark-only (Noop in product, where this is never advanced).
// The sink's TelemetryLabelGuard additionally caps distinct label sets (hence `poolId` values)
// per metric at DEFAULT_MAX_SERIES_PER_METRIC; excess series are rejected as "cardinality".
let nextPoolOrdinal = 0;

function makeCounters(): PoolCounters {
  return {
    acquires: 0,
    releases: 0,
    terminatedPins: 0,
    opens: 0,
    rehydrations: 0,
    admits: 0,
    closes: 0,
    evictions: 0,
    failures: 0,
    overBudgetPeriods: 0,
  };
}

type Entry = {
  hydrator: SourceHydrator<unknown>;
  value: Promise<unknown>;
  pins: number;
  // Estimated resident bytes for this entry. 0 until the value resolves (for acquire()).
  weight: number;
};

/**
 * Bounded LRU pool of hydrated (heavyweight) sources. Residency is bounded by a hybrid budget:
 * a primary byte budget (`maxBytes`, via each entry's estimated `weight`) and a safety count cap
 * (`maxCount`). Least-recently-used *unpinned* entries are closed when the pool is over either
 * bound, but never below `minResident` entries and never while pinned (so the pool may temporarily
 * exceed its bounds when more than the budget's worth of sources are active at once).
 *
 * With no `maxBytes` set the pool is a pure count cap, and with no `weigh` hook every entry
 * weighs 1.
 *
 * A JS Map preserves insertion order, so re-inserting an entry on access implements LRU ordering
 * (oldest first).
 *
 * Stats & telemetry: the pool always maintains cheap numeric bookkeeping exposed via
 * `getStats()` (see `HydratedSourcePoolStats`). Pin accounting obeys the invariant
 * `acquires - releases - terminatedPins === activePins` at all times:
 * - every pin added by acquire() increments `acquires`;
 * - every pin removed by release() or by rolling back a failed acquire() increments `releases`
 *   (the rollback additionally increments `failures`);
 * - terminate() moves all outstanding pins to `terminatedPins` (pins rolled back after terminate
 *   are therefore not counted again).
 *
 * "Over budget" means that after an eviction pass the pool is still above `maxCount` or
 * `maxBytes` (only possible because the remaining entries are pinned or protected by
 * `minResident`). Entering the state starts a period (`overBudgetPeriods`), leaving it adds the
 * elapsed time to `overBudgetDurationMs`. High-water marks for resident count/bytes are sampled
 * after eviction passes (momentary values inside a synchronous insert+evict step are not
 * recorded); the active-pin and pending-entry high-water marks are sampled when pins are added.
 *
 * When the telemetry sink captured at construction is enabled, gauges and counter increments
 * (scope "pipeline", label `{ poolId }`, prefix `pipeline.hydratedSourcePool.`) are pushed after
 * each state change; the sink keeps the last value and publishes at its own cadence. With the
 * default no-op sink nothing beyond the numeric bookkeeping happens.
 */
export class HydratedSourcePool {
  readonly #maxBytes: number;
  readonly #maxCount: number;
  readonly #minResident: number;
  // Insertion order is LRU order: the first entry is the least-recently-used.
  readonly #entries = new Map<object, Entry>();
  #totalWeight = 0;
  #overCapacityReported = false;
  #terminated = false;

  // --- Stats (always maintained; plain numbers, no allocation on the hot path) ---
  readonly #counts: PoolCounters = makeCounters();
  #activePins = 0;
  #overBudget = false;
  #overBudgetSince = 0;
  // Duration of closed over-budget periods; the open period is added on read.
  #overBudgetClosedMs = 0;
  #highWaterResidentCount = 0;
  #highWaterResidentBytes = 0;
  #highWaterActivePins = 0;
  // Tokens evicted at least once; a later open() of such a token is a re-hydration.
  readonly #evictedTokens = new WeakSet<object>();
  readonly #now: () => number;

  // --- Telemetry (resolved once at construction) ---
  readonly #telemetry: ITelemetry;
  readonly #telemetryEnabled: boolean;
  readonly #telemetryLabels: TelemetryLabels | undefined;
  // Counter values already pushed to the sink; only allocated when telemetry is enabled.
  readonly #publishedCounts: PoolCounters | undefined;
  #publishedOverBudgetMs = 0;
  #publishedOnce = false;

  public constructor(options: HydratedSourcePoolOptions) {
    this.#maxCount =
      options.maxCount != undefined
        ? Math.max(1, Math.floor(options.maxCount))
        : Number.POSITIVE_INFINITY;
    this.#maxBytes = options.maxBytes ?? Number.POSITIVE_INFINITY;
    // Never let the resident floor exceed the count cap (Math.min with Infinity is a no-op when
    // maxCount is unset).
    this.#minResident = Math.min(this.#maxCount, Math.max(1, Math.floor(options.minResident ?? 1)));

    this.#now = options.now ?? monotonicNow;
    this.#telemetry = options.telemetry ?? getTelemetry();
    this.#telemetryEnabled = this.#telemetry.isEnabled();
    if (this.#telemetryEnabled) {
      this.#telemetryLabels = Object.freeze({
        poolId: options.poolId ?? `pool-${++nextPoolOrdinal}`,
      });
      this.#publishedCounts = makeCounters();
    }
  }

  /** Snapshot of the pool's bookkeeping. See `HydratedSourcePoolStats` for semantics. */
  public getStats(): HydratedSourcePoolStats {
    const counts = this.#counts;
    return {
      residentCount: this.#entries.size,
      residentBytes: this.#totalWeight,
      pinnedEntries: this.#pinnedEntryCount(),
      activePins: this.#activePins,
      acquires: counts.acquires,
      releases: counts.releases,
      terminatedPins: counts.terminatedPins,
      opens: counts.opens,
      rehydrations: counts.rehydrations,
      admits: counts.admits,
      closes: counts.closes,
      evictions: counts.evictions,
      failures: counts.failures,
      overBudget: this.#overBudget,
      overBudgetPeriods: counts.overBudgetPeriods,
      overBudgetDurationMs: this.#overBudgetDurationMs(),
      highWaterResidentCount: this.#highWaterResidentCount,
      highWaterResidentBytes: this.#highWaterResidentBytes,
      highWaterActivePins: this.#highWaterActivePins,
    };
  }

  // eslint-disable-next-line no-restricted-syntax
  public get size(): number {
    return this.#entries.size;
  }

  /**
   * Seed the pool with an already-hydrated value produced elsewhere (e.g. during initialization),
   * avoiding a redundant open(). The entry starts unpinned and may be evicted immediately if the
   * pool is already over budget. `hydrator.open` is used for later re-hydration after eviction.
   */
  public async admit<T>(token: object, hydrator: SourceHydrator<T>, value: T): Promise<void> {
    if (this.#terminated) {
      // Pool is torn down: never retain new values.
      this.#counts.closes += 1;
      this.#publish();
      await hydrator.close(value);
      return;
    }
    const existing = this.#entries.get(token);
    if (existing) {
      // Refresh recency; keep the existing (possibly in-use) value and drop the new one.
      this.#entries.delete(token);
      this.#entries.set(token, existing);
      this.#counts.closes += 1;
      this.#publish();
      await hydrator.close(value);
      return;
    }
    const weight = Math.max(0, hydrator.weigh?.(value) ?? 1);
    this.#entries.set(token, {
      hydrator: hydrator as SourceHydrator<unknown>,
      value: Promise.resolve(value),
      pins: 0,
      weight,
    });
    this.#totalWeight += weight;
    this.#counts.admits += 1;
    // The eviction pass settles budget state / high-water marks and publishes.
    await this.#evictBeyondCapacity();
  }

  /**
   * Acquire the hydrated value for `token`, hydrating via `hydrator.open()` if it is not resident.
   * The entry is pinned until the matching release(token) call, so it cannot be evicted while used.
   * Callers MUST call release(token) exactly once per acquire, ideally in a finally block.
   */
  public async acquire<T>(token: object, hydrator: SourceHydrator<T>): Promise<T> {
    if (this.#terminated) {
      throw new Error("HydratedSourcePool has been terminated");
    }
    const existing = this.#entries.get(token);
    if (existing) {
      this.#entries.delete(token);
      this.#entries.set(token, existing);
      existing.pins += 1;
      this.#onPinAdded();
      try {
        return (await existing.value) as T;
      } catch (err) {
        // A co-pending open() rejected: drop the pin we just added so the (already removed by the
        // hydrating caller) entry does not leak a phantom pin.
        existing.pins -= 1;
        this.#onFailedAcquire();
        throw err;
      }
    }

    if (this.#evictedTokens.has(token)) {
      this.#counts.rehydrations += 1;
    }
    this.#counts.opens += 1;
    const entry: Entry = {
      hydrator: hydrator as SourceHydrator<unknown>,
      value: hydrator.open(),
      pins: 1,
      weight: 0,
    };
    this.#entries.set(token, entry);
    this.#onPinAdded();
    try {
      const value = (await entry.value) as T;
      entry.weight = Math.max(0, hydrator.weigh?.(value) ?? 1);
      // Only account the weight while the entry is still resident: terminate() may have cleared
      // the pool (and reset #totalWeight) while this hydration was pending.
      if (this.#entries.get(token) === entry) {
        this.#totalWeight += entry.weight;
      }
      await this.#evictBeyondCapacity();
      log.debug(
        `hydrated source; resident=${this.#entries.size}/${this.#maxCount} bytes=${this.#totalWeight}/${this.#maxBytes}`,
      );
      return value;
    } catch (err) {
      // Hydration failed: remove the broken entry so a later acquire can retry. Guard on entry
      // identity so a late rejection cannot delete a newer entry re-created for the same token.
      // Its weight was never added to #totalWeight, so there is nothing to roll back.
      entry.pins -= 1;
      if (this.#entries.get(token) === entry) {
        this.#entries.delete(token);
      }
      this.#onFailedAcquire();
      this.#settle();
      throw err;
    }
  }

  /** Release one pin previously taken by acquire(). Unpinned entries become evictable. */
  public release(token: object): void {
    const entry = this.#entries.get(token);
    if (!entry) {
      return;
    }
    if (entry.pins > 0) {
      entry.pins -= 1;
      this.#counts.releases += 1;
      this.#activePins -= 1;
    }
    // Opportunistically reclaim memory if we are over budget and this entry is now evictable.
    void this.#evictBeyondCapacity().catch((err: unknown) => {
      log.error("HydratedSourcePool eviction failed", err);
    });
  }

  /** Close and remove every entry. Use on teardown. */
  public async terminate(): Promise<void> {
    // Mark terminal before clearing so concurrent acquire()/admit() cannot hydrate or retain.
    this.#terminated = true;
    const entries = [...this.#entries.entries()];
    this.#entries.clear();
    this.#totalWeight = 0;
    // Every pin still outstanding is dropped with the pool; later rollbacks are not re-counted.
    this.#counts.terminatedPins += this.#activePins;
    this.#activePins = 0;
    this.#settle();
    await Promise.all(
      entries.map(async ([, entry]) => {
        try {
          const value = await entry.value;
          this.#counts.closes += 1;
          await entry.hydrator.close(value);
        } catch (err) {
          log.error("HydratedSourcePool terminate close failed", err);
        }
      }),
    );
    this.#publish();
  }

  // True when the pool exceeds either bound and may shed a least-recently-used unpinned entry.
  #isOverCapacity(): boolean {
    if (this.#entries.size <= this.#minResident) {
      return false;
    }
    return this.#entries.size > this.#maxCount || this.#totalWeight > this.#maxBytes;
  }

  // Close least-recently-used unpinned entries until within budget, `minResident` is reached, or
  // only pinned entries remain (in which case the pool temporarily exceeds its bounds).
  async #evictBeyondCapacity(): Promise<void> {
    while (this.#isOverCapacity()) {
      let evictKey: object | undefined;
      for (const [key, entry] of this.#entries) {
        if (entry.pins === 0) {
          evictKey = key;
          break;
        }
      }
      if (evictKey == undefined) {
        this.#settle();
        return; // All remaining entries are pinned/in-use.
      }
      if (!this.#overCapacityReported) {
        this.#overCapacityReported = true;
        log.info(
          `HydratedSourcePool over capacity: capping resident sources (maxCount=${this.#maxCount}, maxBytes=${this.#maxBytes}) and re-opening others on demand.`,
        );
      }
      const entry = this.#entries.get(evictKey)!;
      // Delete before awaiting close so concurrent evictions never target the same entry twice.
      this.#entries.delete(evictKey);
      this.#totalWeight -= entry.weight;
      this.#evictedTokens.add(evictKey);
      this.#counts.evictions += 1;
      try {
        const value = await entry.value;
        this.#counts.closes += 1;
        await entry.hydrator.close(value);
      } catch (err) {
        log.error("HydratedSourcePool evict close failed", err);
      }
      log.debug(`evicted LRU source; resident=${this.#entries.size}/${this.#maxCount}`);
    }
    this.#settle();
  }

  // A pin was added by acquire() (resident hit or new pending entry).
  #onPinAdded(): void {
    this.#counts.acquires += 1;
    this.#activePins += 1;
    if (this.#activePins > this.#highWaterActivePins) {
      this.#highWaterActivePins = this.#activePins;
    }
    // A new pending entry is real residency (a reader is being opened), so sample it here.
    if (this.#entries.size > this.#highWaterResidentCount) {
      this.#highWaterResidentCount = this.#entries.size;
    }
    this.#publish();
  }

  // An acquire() rejected and its pin was rolled back. After terminate() the pin was already
  // moved to `terminatedPins`, so only the failure is counted.
  #onFailedAcquire(): void {
    this.#counts.failures += 1;
    if (!this.#terminated) {
      this.#counts.releases += 1;
      this.#activePins -= 1;
    }
  }

  // Re-evaluate the over-budget state and resident high-water marks after an eviction pass (or
  // another residency change that is not followed by one), then publish.
  #settle(): void {
    const size = this.#entries.size;
    const over = size > this.#maxCount || this.#totalWeight > this.#maxBytes;
    if (over !== this.#overBudget) {
      const now = this.#now();
      if (over) {
        this.#overBudgetSince = now;
        this.#counts.overBudgetPeriods += 1;
      } else {
        this.#overBudgetClosedMs += Math.max(0, now - this.#overBudgetSince);
      }
      this.#overBudget = over;
    }
    if (size > this.#highWaterResidentCount) {
      this.#highWaterResidentCount = size;
    }
    if (this.#totalWeight > this.#highWaterResidentBytes) {
      this.#highWaterResidentBytes = this.#totalWeight;
    }
    this.#publish();
  }

  #overBudgetDurationMs(): number {
    if (!this.#overBudget) {
      return this.#overBudgetClosedMs;
    }
    return this.#overBudgetClosedMs + Math.max(0, this.#now() - this.#overBudgetSince);
  }

  #pinnedEntryCount(): number {
    let count = 0;
    for (const entry of this.#entries.values()) {
      if (entry.pins > 0) {
        count += 1;
      }
    }
    return count;
  }

  // Push current gauges and counter increments to the sink. No-op unless telemetry was enabled at
  // construction.
  #publish(): void {
    const published = this.#publishedCounts;
    if (!this.#telemetryEnabled || published == undefined) {
      return;
    }
    const telemetry = this.#telemetry;
    const labels = this.#telemetryLabels;
    telemetry.gauge(
      HYDRATED_SOURCE_POOL_GAUGE_METRICS.residentCount,
      this.#entries.size,
      "count",
      "pipeline",
      labels,
    );
    telemetry.gauge(
      HYDRATED_SOURCE_POOL_GAUGE_METRICS.residentBytes,
      this.#totalWeight,
      "bytes",
      "pipeline",
      labels,
    );
    telemetry.gauge(
      HYDRATED_SOURCE_POOL_GAUGE_METRICS.pinnedEntries,
      this.#pinnedEntryCount(),
      "count",
      "pipeline",
      labels,
    );
    telemetry.gauge(
      HYDRATED_SOURCE_POOL_GAUGE_METRICS.activePins,
      this.#activePins,
      "count",
      "pipeline",
      labels,
    );
    telemetry.gauge(
      HYDRATED_SOURCE_POOL_GAUGE_METRICS.overBudget,
      this.#overBudget ? 1 : 0,
      "count",
      "pipeline",
      labels,
    );
    telemetry.gauge(
      HYDRATED_SOURCE_POOL_GAUGE_METRICS.highWaterResidentCount,
      this.#highWaterResidentCount,
      "count",
      "pipeline",
      labels,
    );
    telemetry.gauge(
      HYDRATED_SOURCE_POOL_GAUGE_METRICS.highWaterResidentBytes,
      this.#highWaterResidentBytes,
      "bytes",
      "pipeline",
      labels,
    );
    telemetry.gauge(
      HYDRATED_SOURCE_POOL_GAUGE_METRICS.highWaterActivePins,
      this.#highWaterActivePins,
      "count",
      "pipeline",
      labels,
    );

    // Counters: push increments since the previous publish. The first publish registers every
    // series (increment 0 allowed) so reports see explicit zeros.
    const counts = this.#counts;
    const first = !this.#publishedOnce;
    for (const key of HYDRATED_SOURCE_POOL_COUNTER_KEYS) {
      const delta = counts[key] - published[key];
      if (delta > 0 || first) {
        telemetry.counter(
          HYDRATED_SOURCE_POOL_COUNTER_METRICS[key],
          delta,
          "count",
          "pipeline",
          labels,
        );
        published[key] = counts[key];
      }
    }
    const overBudgetMs = this.#overBudgetDurationMs();
    const overBudgetDelta = overBudgetMs - this.#publishedOverBudgetMs;
    if (overBudgetDelta > 0 || first) {
      telemetry.counter(
        HYDRATED_SOURCE_POOL_OVER_BUDGET_DURATION_METRIC,
        Math.max(0, overBudgetDelta),
        "ms",
        "pipeline",
        labels,
      );
      this.#publishedOverBudgetMs = overBudgetMs;
    }
    this.#publishedOnce = true;
  }
}
