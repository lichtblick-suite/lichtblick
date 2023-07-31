// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// eslint-disable-next-line no-restricted-syntax
type Null = null;

/**
 * Convenience function to check that _val_ is defined and return the value if it is defined. Throw
 * if it is undefined or null.
 *
 * @param val value that is checked for non-nullable
 * @returns val if val is defined
 */
type MustBeNullable<T> = undefined extends T ? T : Null extends T ? T : never;
export function unwrap<T>(val: MustBeNullable<T>): NonNullable<T> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (val == undefined) {
    throw new Error("Invariant: unexpected undefined value");
  }
  return val;
}
