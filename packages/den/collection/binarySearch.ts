// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Performs a binary search on a sorted array of tuples to find the index of the entry with the given key.
 *
 * Copied from @foxglove/den/collection ArrayMap
 *
 * @param key Key to search for.
 * @returns The index of the key/value tuple if an exact match is found; otherwise, a negative
 * number. If the key is not found and the key is less than one or more keys in the list, the
 * negative number returned is the bitwise complement of the index of the first element with a
 * larger key. If the key is not found and is greater than all keys in the list, the negative
 * number returned is the bitwise complement of the index of the last element plus 1.
 */
function sortedIndexByTuple<T>(items: [bigint, T][], key: bigint): number {
  const list = items;
  if (list.length === 0) {
    return -1;
  }

  let left = 0;
  let right = list.length - 1;

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

export { sortedIndexByTuple };
