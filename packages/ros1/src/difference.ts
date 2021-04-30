// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Return the set difference between an array and another array or iterable.
// The results are not sorted in any stable ordering
export function difference<T>(a: T[], b: T[] | IterableIterator<T>): T[] {
  const sb = new Set(b);
  return Array.from(new Set(a.filter((x) => !sb.has(x))).values());
}
