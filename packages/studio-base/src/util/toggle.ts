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

import { reject } from "lodash";

// toggles an item in an array based on reference equality
// or an optional predicate to determine if the item should be toggled in/out
// this function is pure - it always returns a new array
export default function toggle<T>(
  array: T[],
  item: T,
  predicate: (arg0: T) => boolean = (el) => el === item,
): T[] {
  const newArray = reject(array, predicate);
  if (newArray.length === array.length) {
    newArray.push(item);
  }
  return newArray;
}
