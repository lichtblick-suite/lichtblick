// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// It's helpful for this code to handle null as input
/* eslint-disable no-restricted-syntax */

// Theoretically we could provide isEmptyOrUndefined as a type guard returning `str is "" |
// undefined`, but this doesn't work: https://github.com/microsoft/TypeScript/issues/31156

export function isNonEmptyOrUndefined<T>(arr: readonly T[] | null | undefined): arr is readonly T[];
export function isNonEmptyOrUndefined(str: string | null | undefined): str is string;
export function isNonEmptyOrUndefined<T>(val: string | readonly T[] | null | undefined): boolean {
  return val != undefined && val.length !== 0;
}

export function nonEmptyOrUndefined(str: string | null | undefined): string | undefined {
  return str == undefined || str.length === 0 ? undefined : str;
}
