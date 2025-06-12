// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * A list of values with type `V` sorted by numeric keys of type `K`
 * (either number or BigInt). Keys are unique, so setting a value with the same
 * key as an existing entry is a replacement operation.
 */
export class ArrayMap<K, V> {
  #list: [K, V][] = [];

  // eslint-disable-next-line no-restricted-syntax
  public get size(): number {
    return this.#list.length;
  }

  /** Clears array and returns removed elements */
  public clear(): [K, V][] {
    return this.#list.splice(0);
  }

  public [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.#list[Symbol.iterator]();
  }

  /** Retrieve the key/value tuple at the given index, if it exists. */
  public at(index: number): [K, V] | undefined {
    return this.#list[index];
  }

  /**
   * Store a key/value tuple in the sorted list. If the key already exists, the
   * previous entry is overwritten.
   * Returns replaced value if it exists.
   */
  public set(key: K, value: V): V | undefined {
    const index = this.binarySearch(key);
    if (index >= 0) {
      const existingEntry = this.#list[index]![1];
      this.#list[index]![1] = value;
      return existingEntry;
    } else {
      const newEntry: [K, V] = [key, value];
      const greaterThanIndex = ~index;
      if (greaterThanIndex >= this.#list.length) {
        this.#list.push(newEntry);
      } else {
        this.#list.splice(greaterThanIndex, 0, newEntry);
      }
    }
    return undefined;
  }

  /** Removes the first element and returns it, if available. */
  public shift(): [K, V] | undefined {
    return this.#list.shift();
  }

  /** Removes the last element and returns it, if available. */
  public pop(): [K, V] | undefined {
    return this.#list.pop();
  }

  /** Removes the element with the given key, if it exists.
   * Returns element removed.
   */
  public remove(key: K): [K, V] | undefined {
    const index = this.binarySearch(key);
    if (index >= 0) {
      return this.#list.splice(index, 1)[0];
    }
    return undefined;
  }

  /** Removes all elements with keys greater than the given key.
   * Returns elements removed.
   */
  public removeAfter(key: K): [K, V][] {
    const index = this.binarySearch(key);
    const greaterThanIndex = index >= 0 ? index + 1 : ~index;
    const removed = this.#list.splice(greaterThanIndex);
    return removed;
  }

  /** Removes all elements with keys less than the given key.
   * Returns elements removed.
   */
  public removeBefore(key: K): [K, V][] {
    const index = this.binarySearch(key);
    const lessThanIndex = index >= 0 ? index : ~index;
    return this.#list.splice(0, lessThanIndex);
  }

  /** Access the first key/value tuple in the list, without modifying the list. */
  public minEntry(): [K, V] | undefined {
    return this.#list[0];
  }

  /** Access the last key/value tuple in the list, without modifying the list. */
  public maxEntry(): [K, V] | undefined {
    return this.#list[this.#list.length - 1];
  }

  /** Access the first key in the list, without modifying the list. */
  public minKey(): K | undefined {
    return this.#list[0]?.[0];
  }

  /** Access the last key in the list, without modifying the list. */
  public maxKey(): K | undefined {
    return this.#list[this.#list.length - 1]?.[0];
  }

  /**
   * Performs a binary search on the sorted list to find the index of the entry
   * with the given key.
   * @param key Key to search for.
   * @returns The index of the key/value tuple if an exact match is found;
   * otherwise, a negative number. If the key is not found and the key is less
   * than one or more keys in the list, the negative number returned is the
   * bitwise complement of the index of the first element with a larger key. If
   * the key is not found and is greater than all keys in the list, the negative
   * number returned is the bitwise complement of the index of the last element
   * plus 1.
   */
  public binarySearch(key: K): number {
    const list = this.#list;
    if (list.length === 0) {
      return -1;
    }

    let left = 0;
    let right = list.length - 1;

    // Quick checks to see if key is outside the bounds of the list
    if (key < list[left]![0]) {
      return ~left;
    } else if (key > list[right]![0]) {
      return ~(right + 1);
    }

    while (left <= right) {
      const mid = (left + right) >> 1;
      const midKey = list[mid]![0];

      if (midKey === key) {
        return mid;
      } else if (key < midKey) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return ~left;
  }
}
