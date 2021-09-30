// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * @returns An iterable producing all N! possible permutations of the items in `values`.
 */
export default function* permutations<T>(values: T[]): Iterable<T[]> {
  if (values.length < 2) {
    yield values;
    return;
  }
  for (let i = 0; i < values.length; ++i) {
    const element = values[i]!;
    const rest = [...values.slice(0, i), ...values.slice(i + 1)];
    for (const restPermutation of permutations(rest)) {
      yield [element, ...restPermutation];
    }
  }
}
