// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { diff } from "just-diff";

import { LayoutData } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";

/**
 * isLayoutEqual compares two LayoutData instances for "equality". If the two instances are
 * considered "equal" then the function returns true. If the two instances are not equal it returns
 * false.
 *
 * Layout instances are considered equal if they have all of the same fields and all of the same
 * values in those fields - recursively. An exception is made for where _b_ only differes from _a_
 * by introducing new fields which are _undefined_. If _b_ has an extra field with value undefined,
 * it will still be considered equal to _a_.
 */
export function isLayoutEqual(a: LayoutData, b: LayoutData): boolean {
  const res = diff(a, b);
  for (const item of res) {
    // Any replace or remove is treated as a diff
    if (item.op === "replace" || item.op === "remove") {
      return false;
    }

    // If a field is added but the value is anything other than undefined, the layouts are not the same
    if (item.value != undefined) {
      return false;
    }
  }

  // No actual diff, so the values are the same
  return true;
}
