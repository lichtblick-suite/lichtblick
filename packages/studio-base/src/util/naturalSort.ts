// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import natsort from "natsort";

const sortFn = natsort({ insensitive: true });

type StringOrNumberFields<T> = T extends Record<string, unknown>
  ? { [K in keyof T]: T[K] extends string | number ? K : never }[keyof T]
  : never;

function naturalSort(): typeof sortFn;
function naturalSort<T, K extends StringOrNumberFields<T>>(key: K): (a: T, b: T) => number;
function naturalSort<T, K extends StringOrNumberFields<T>>(key?: K): unknown {
  return key == undefined
    ? sortFn
    : (a: T, b: T) =>
        sortFn(a[key] as unknown as string | number, b[key] as unknown as string | number);
}

export default naturalSort;
