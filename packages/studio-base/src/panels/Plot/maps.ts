// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Merges values from a & b into a new map, applying fn at each key.
 */
export function merge<K, V1, V2, V3>(
  a: ReadonlyMap<K, V1>,
  b: ReadonlyMap<K, V2>,
  fn: (aval: V1, bval: V2, key: K) => V3,
): Map<K, V1 | V2 | V3> {
  const dest: Map<K, V1 | V2 | V3> = new Map();

  for (const [key, aVal] of a) {
    const bVal = b.get(key);
    if (bVal == undefined) {
      dest.set(key, aVal);
    } else {
      dest.set(key, fn(aVal, bVal, key));
    }
  }

  for (const [key, bVal] of b) {
    if (dest.has(key)) {
      continue;
    }

    const aVal = a.get(key);
    if (aVal == undefined) {
      dest.set(key, bVal);
    } else {
      dest.set(key, fn(aVal, bVal, key));
    }
  }

  return dest;
}

/**
 * Generates a new map from input with the same keys but with fn applied to each value.
 */
export function mapValues<K, V, V2>(
  input: ReadonlyMap<K, V>,
  fn: (val: V, key: K) => V2,
): Map<K, V2> {
  const newEntries: [K, V2][] = [];
  for (const [key, value] of input) {
    newEntries.push([key, fn(value, key)]);
  }
  return new Map(newEntries);
}

/**
 * Returns a new map containing only the keys in keys.
 */
export function pick<K, V>(input: ReadonlyMap<K, V>, keys: readonly K[]): Map<K, V> {
  const newEntries: [K, V][] = [];
  for (const [key, value] of input) {
    if (keys.includes(key)) {
      newEntries.push([key, value]);
    }
  }
  return new Map(newEntries);
}
