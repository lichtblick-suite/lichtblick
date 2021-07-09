// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isTypedArray as lodashIsTypedArray } from "lodash";

type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

function isTypedArray(value: unknown): value is TypedArray {
  return lodashIsTypedArray(value);
}

/** A JSON.stringify replacer to support bigints and typed arrays */
export function copyMessageReplacer(_key: unknown, value: unknown): unknown {
  if (value == undefined) {
    return;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (isTypedArray(value)) {
    return Array.from<unknown>(value);
  }
  return value;
}
