// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * A Map that organizes values by two levels of keys, i.e. a wrapper around Map<K1, Map<K2, V>>.
 */
export class TwoKeyMap<K1, K2, V> {
  #map = new Map<K1, Map<K2, V>>();

  public get(key1: K1, key2: K2): V | undefined {
    return this.#map.get(key1)?.get(key2);
  }

  public set(key1: K1, key2: K2, value: V): void {
    let map2 = this.#map.get(key1);
    if (map2 == undefined) {
      map2 = new Map<K2, V>();
      this.#map.set(key1, map2);
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
    }
  }

  public deleteAll(key1: K1): void {
    this.#map.delete(key1);
  }

  public clear(): void {
    this.#map.clear();
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
}
