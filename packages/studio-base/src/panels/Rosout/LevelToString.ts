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

export const KNOWN_LOG_LEVELS: Array<number> = [1, 2, 4, 8, 16];

// map a numeric level to a string
export default function LevelToString(level: number): string {
  switch (level) {
    case 1:
    case 10:
      return "DEBUG";
    case 2:
    case 20:
      return "INFO";
    case 4:
    case 30:
      return "WARN";
    case 8:
    case 40:
      return "ERROR";
    case 16:
    case 50:
      return "FATAL";
    default:
      return "?????";
  }
}
