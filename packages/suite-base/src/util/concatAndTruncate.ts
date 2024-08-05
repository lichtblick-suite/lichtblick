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

export default function concatAndTruncate<T>(
  array1: readonly T[],
  array2: readonly T[],
  limit: number,
): T[] {
  const toTakeFromArray1 = limit - array2.length;
  const ret = toTakeFromArray1 <= 0 ? [] : array1.slice(-toTakeFromArray1);
  const toTakeFromArray2 = limit - ret.length;
  for (let i = Math.max(0, array2.length - toTakeFromArray2); i < array2.length; ++i) {
    ret.push(array2[i] as T);
  }
  return ret;
}
