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

import { Time, toMillis, fromMillis } from "@foxglove/rostime";

const ARROW_SEEK_BIG_MS = 500;
const ARROW_SEEK_DEFAULT_MS = 100;
const ARROW_SEEK_SMALL_MS = 10;
export const DIRECTION = {
  FORWARD: 1,
  BACKWARD: -1,
};

export const jumpSeek = (
  directionSign: typeof DIRECTION[keyof typeof DIRECTION],
  currentTime: Time,
  modifierKeys?: { altKey: boolean; shiftKey: boolean },
): Time => {
  const timeMs = toMillis(currentTime);
  const deltaMs =
    modifierKeys?.altKey === true
      ? ARROW_SEEK_BIG_MS
      : modifierKeys?.shiftKey === true
      ? ARROW_SEEK_SMALL_MS
      : ARROW_SEEK_DEFAULT_MS;
  return fromMillis(timeMs + deltaMs * directionSign);
};
