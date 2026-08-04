// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Logger from "@lichtblick/log";

import type { HydratedSourcePoolOptions, SourceHydrator } from "./types";

// Re-exported so the existing external import of this type from "./HydratedSourcePool" keeps
// working; its canonical definition now lives in shared/types.ts. HydratedSourcePoolOptions is
// only used internally here (constructor parameter type) — external consumers import it directly
// from "./types".
export type { SourceHydrator };

const log = Logger.getLogger(__filename);

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

  public constructor(options: HydratedSourcePoolOptions) {
    this.#maxCount =
      options.maxCount != undefined
        ? Math.max(1, Math.floor(options.maxCount))
        : Number.POSITIVE_INFINITY;
    this.#maxBytes = options.maxBytes ?? Number.POSITIVE_INFINITY;
    // Never let the resident floor exceed the count cap (Math.min with Infinity is a no-op when
    // maxCount is unset).
    this.#minResident = Math.min(this.#maxCount, Math.max(1, Math.floor(options.minResident ?? 1)));
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
      await hydrator.close(value);
      return;
    }
    const existing = this.#entries.get(token);
    if (existing) {
      // Refresh recency; keep the existing (possibly in-use) value and drop the new one.
      this.#entries.delete(token);
      this.#entries.set(token, existing);
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
      try {
        return (await existing.value) as T;
      } catch (err) {
        // A co-pending open() rejected: drop the pin we just added so the (already removed by the
        // hydrating caller) entry does not leak a phantom pin.
        existing.pins -= 1;
        throw err;
      }
    }

    const entry: Entry = {
      hydrator: hydrator as SourceHydrator<unknown>,
      value: hydrator.open(),
      pins: 1,
      weight: 0,
    };
    this.#entries.set(token, entry);
    try {
      const value = (await entry.value) as T;
      entry.weight = Math.max(0, hydrator.weigh?.(value) ?? 1);
      this.#totalWeight += entry.weight;
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
    await Promise.all(
      entries.map(async ([, entry]) => {
        try {
          await entry.hydrator.close(await entry.value);
        } catch (err) {
          log.error("HydratedSourcePool terminate close failed", err);
        }
      }),
    );
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
      try {
        await entry.hydrator.close(await entry.value);
      } catch (err) {
        log.error("HydratedSourcePool evict close failed", err);
      }
      log.debug(`evicted LRU source; resident=${this.#entries.size}/${this.#maxCount}`);
    }
  }
}
