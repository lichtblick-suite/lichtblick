// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Casts a value to a possibly undefined value of a new type.
 */
export function maybeCast<T>(v: unknown): undefined | T {
  return v as undefined | T;
}
