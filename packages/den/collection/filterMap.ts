// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

/**
 * filterMap creates a new array populated with the results of calling a provided function on every
 * element in the calling array. Results which resolve to a javascript "false" value are discarded
 * from the array.
 *
 * This is a more efficient version of [...values].map(mapFn).filter(Boolean) that avoids two
 * iterations of the array.
 */
export default function filterMap<T, U>(
  values: Iterable<T>,
  mapFn: (arg0: T, arg1: number) => U | undefined,
): U[] {
  const results: Array<U> = [];
  let index = 0;
  for (const item of values) {
    const mappedItem = mapFn(item, index++);
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (mappedItem) {
      results.push(mappedItem);
    }
  }
  return results;
}
