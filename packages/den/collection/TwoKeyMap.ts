// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * A Map that organizes values by two levels of keys, i.e. a wrapper around Map<K1, Map<K2, V>>.
 */
export class TwoKeyMap<K1, K2, V> {
  #map = new Map<K1, Map<K2, V>>();
  #size = 0;

  public get(key1: K1, key2: K2): V | undefined {
    return this.#map.get(key1)?.get(key2);
  }

  public set(key1: K1, key2: K2, value: V): void {
    let map2 = this.#map.get(key1);
    if (map2 == undefined) {
      map2 = new Map<K2, V>();
      this.#map.set(key1, map2);
    }
    if (!map2.has(key2)) {
      this.#size++;
    }
    map2.set(key2, value);
  }

  public delete(key1: K1, key2: K2): void {
    const map2 = this.#map.get(key1);
    if (map2 != undefined) {
      map2.delete(key2);
      if (map2.size === 0) {
        this.#map.delete(key1);
      }
      this.#size--;
    }
  }

  public deleteAll(key1: K1): void {
    this.#size -= this.#map.get(key1)?.size ?? 0;
    this.#map.delete(key1);
  }

  public clear(): void {
    this.#size = 0;
    this.#map.clear();
  }

  /** Number of key1, key2 pairs currently in the map */
  // eslint-disable-next-line no-restricted-syntax
  public get size(): number {
    return this.#size;
  }

  /**
   * Iterate over all values. This may not be in the original insertion order, since keys may have
   * been added to the two levels of maps in different orders.
   */
  public *values(): Iterable<V> {
    for (const map2 of this.#map.values()) {
      yield* map2.values();
    }
  }

  /**
   * Iterates over all [key1, key2], value pairs. This may not be in the original insertion order.
   */
  public *entries(): Iterable<[[K1, K2], V]> {
    for (const [key1, map2] of this.#map.entries()) {
      for (const [key2, v] of map2.entries()) {
        yield [[key1, key2], v];
      }
    }
  }
  /**
   * Iterates over all [key1, key2], value pairs. This may not be in the original insertion order.
   */
  public *keys(): Iterable<[K1, K2]> {
    for (const [key1, map2] of this.#map.entries()) {
      for (const key2 of map2.keys()) {
        yield [key1, key2];
      }
    }
  }
}
