// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * minIndexBy scans a collection and returns the index of the smallest item
 *
 * minIndexBy iterates the collection and calls compare on each item of the collection. If an item
 * compares smaller than another, then its index becomes the smallest index. iteration continues
 * until the end of the collection. The index is then returned.
 *
 * @param collection the collection to scan
 * @param compare function used to compare two items in the collection. A value of < 0 means a < b.
 * @returns the index of the smallest item in the collection or -1 if the collection is empty
 */
function minIndexBy<T>(collection: Array<T>, compare: (itemA: T, itemB: T) => number): number {
  if (collection.length === 0) {
    return -1;
  }

  let minIdx = 0;
  let minItem = collection[0]!;

  for (let i = 1; i < collection.length; ++i) {
    const item = collection[i]!;
    if (compare(item, minItem) < 0) {
      minIdx = i;
      minItem = item;
    }
  }

  return minIdx;
}

export { minIndexBy };
