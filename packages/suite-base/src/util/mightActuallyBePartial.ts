// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Marks a value as possibly having missing properties even if the specified type is
 * complete. Used to manually add checks for missing values without flagging the
 * @typescript-eslint/no-unnecessary-condition rule.
 *
 * If you need this it probably means your types are not rigorous enough.
 */
export function mightActuallyBePartial<T>(value: T): Partial<T> {
  return value as Partial<T>;
}
