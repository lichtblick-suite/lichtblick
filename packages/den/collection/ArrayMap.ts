// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * A list of values with type `V` sorted by numeric keys of type `K`
 * (either number or BigInt). Keys are unique, so setting a value with the same
 * key as an existing entry is a replacement operation.
 */
export class ArrayMap<K, V> {
  private _list: [K, V][] = [];

  // eslint-disable-next-line no-restricted-syntax
  public get size(): number {
    return this._list.length;
  }

  public clear(): void {
    this._list.length = 0;
  }

  /** Retrieve the key/value tuple at the given index, if it exists. */
  public at(index: number): [K, V] | undefined {
    return this._list[index];
  }

  /**
   * Store a key/value tuple in the sorted list. If the key already exists, the
   * previous entry is overwritten.
   */
  public set(key: K, value: V): void {
    const index = this.binarySearch(key);
    if (index >= 0) {
      this._list[index]![1] = value;
    } else {
      const greaterThanIndex = ~index;
      const newEntry: [K, V] = [key, value];
      if (greaterThanIndex >= this._list.length) {
        this._list.push(newEntry);
      } else {
        this._list.splice(greaterThanIndex, 0, newEntry);
      }
    }
  }

  /** Removes the first element and returns it, if available. */
  public shift(): [K, V] | undefined {
    return this._list.shift();
  }

  /** Removes the last element and returns it, if available. */
  public pop(): [K, V] | undefined {
    return this._list.pop();
  }

  /** Removes the element with the given key, if it exists */
  public remove(key: K): void {
    const index = this.binarySearch(key);
    if (index >= 0) {
      this._list.splice(index, 1);
    }
  }

  /** Removes all elements with keys greater than the given key. */
  public removeAfter(key: K): void {
    const index = this.binarySearch(key);
    const greaterThanIndex = index >= 0 ? index + 1 : ~index;
    this._list.length = greaterThanIndex;
  }

  /** Removes all elements with keys less than the given key. */
  public removeBefore(key: K): void {
    const index = this.binarySearch(key);
    const lessThanIndex = index >= 0 ? index : ~index;
    this._list.splice(0, lessThanIndex);
  }

  /** Access the first key/value tuple in the list, without modifying the list. */
  public minEntry(): [K, V] | undefined {
    return this._list[0];
  }

  /** Access the last key/value tuple in the list, without modifying the list. */
  public maxEntry(): [K, V] | undefined {
    return this._list[this._list.length - 1];
  }

  /** Access the first key in the list, without modifying the list. */
  public minKey(): K | undefined {
    return this._list[0]?.[0];
  }

  /** Access the last key in the list, without modifying the list. */
  public maxKey(): K | undefined {
    return this._list[this._list.length - 1]?.[0];
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
    const list = this._list;
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
