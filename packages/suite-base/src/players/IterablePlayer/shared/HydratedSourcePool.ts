// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Logger from "@lichtblick/log";

const log = Logger.getLogger(__filename);

export type SourceHydrator<T> = {
  // Create the heavyweight value (open readable, build reader, parse channels, ...).
  open: () => Promise<T>;
  // Release the heavyweight value (close readable/connection, drop references).
  close: (value: T) => Promise<void>;
};

type Entry = {
  hydrator: SourceHydrator<unknown>;
  value: Promise<unknown>;
  pins: number;
};

/**
 * Bounded LRU pool of hydrated (heavyweight) sources. At most `capacity` entries are kept
 * resident; least-recently-used *unpinned* entries are closed when the pool is over capacity.
 * Entries currently in use are pinned via acquire()/release() and are never evicted while pinned,
 * so the pool may temporarily exceed capacity if more than `capacity` sources are active at once.
 *
 * A JS Map preserves insertion order, so re-inserting an entry on access implements LRU ordering
 * (oldest first).
 */
export class HydratedSourcePool {
  readonly #capacity: number;
  // Insertion order is LRU order: the first entry is the least-recently-used.
  readonly #entries = new Map<object, Entry>();
  #overCapacityReported = false;

  public constructor(capacity: number) {
    this.#capacity = Math.max(1, Math.floor(capacity));
  }

  // eslint-disable-next-line no-restricted-syntax
  public get size(): number {
    return this.#entries.size;
  }

  /**
   * Seed the pool with an already-hydrated value produced elsewhere (e.g. during initialization),
   * avoiding a redundant open(). The entry starts unpinned and may be evicted immediately if the
   * pool is already at capacity. `hydrator.open` is used for later re-hydration after eviction.
   */
  public async admit<T>(token: object, hydrator: SourceHydrator<T>, value: T): Promise<void> {
    const existing = this.#entries.get(token);
    if (existing) {
      // Refresh recency; keep the existing (possibly in-use) value and drop the new one.
      this.#entries.delete(token);
      this.#entries.set(token, existing);
      await hydrator.close(value);
      return;
    }
    this.#entries.set(token, {
      hydrator: hydrator as SourceHydrator<unknown>,
      value: Promise.resolve(value),
      pins: 0,
    });
    await this.#evictBeyondCapacity();
  }

  /**
   * Acquire the hydrated value for `token`, hydrating via `hydrator.open()` if it is not resident.
   * The entry is pinned until the matching release(token) call, so it cannot be evicted while used.
   * Callers MUST call release(token) exactly once per acquire, ideally in a finally block.
   */
  public async acquire<T>(token: object, hydrator: SourceHydrator<T>): Promise<T> {
    const existing = this.#entries.get(token);
    if (existing) {
      // Refresh recency (LRU) and pin.
      this.#entries.delete(token);
      this.#entries.set(token, existing);
      existing.pins += 1;
      return (await existing.value) as T;
    }

    const entry: Entry = {
      hydrator: hydrator as SourceHydrator<unknown>,
      value: hydrator.open(),
      pins: 1,
    };
    this.#entries.set(token, entry);
    try {
      const value = (await entry.value) as T;
      await this.#evictBeyondCapacity();
      log.debug(`hydrated source; resident=${this.#entries.size}/${this.#capacity}`);
      return value;
    } catch (err) {
      // Hydration failed: remove the broken entry so a later acquire can retry.
      entry.pins -= 1;
      this.#entries.delete(token);
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
    // Opportunistically reclaim memory if we are over capacity and this entry is now evictable.
    void this.#evictBeyondCapacity().catch((err: unknown) => {
      log.error("HydratedSourcePool eviction failed", err);
    });
  }

  /** Close and remove every entry. Use on teardown. */
  public async terminate(): Promise<void> {
    const entries = [...this.#entries.entries()];
    this.#entries.clear();
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

  // Close least-recently-used unpinned entries until at or below capacity, or until only pinned
  // entries remain (in which case the pool temporarily exceeds capacity).
  async #evictBeyondCapacity(): Promise<void> {
    while (this.#entries.size > this.#capacity) {
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
          `HydratedSourcePool over capacity: capping resident sources at ${this.#capacity} and re-opening others on demand.`,
        );
      }
      const entry = this.#entries.get(evictKey)!;
      // Delete before awaiting close so concurrent evictions never target the same entry twice.
      this.#entries.delete(evictKey);
      try {
        await entry.hydrator.close(await entry.value);
      } catch (err) {
        log.error("HydratedSourcePool evict close failed", err);
      }
      log.debug(`evicted LRU source; resident=${this.#entries.size}/${this.#capacity}`);
    }
  }
}
