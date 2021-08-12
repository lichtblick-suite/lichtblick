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

import { definitions as commonDefs } from "@foxglove/rosmsg-msgs-common";
import { definitions as foxgloveDefs } from "@foxglove/rosmsg-msgs-foxglove";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

/**
 * basicDatatypes is a map containing definitions for ROS common datatypes and foxglove datatypes
 * from the following packages:
 *
 * - @foxglove/rosmsgs-msg-common
 * - @foxglove/rosmsg-msgs-foxglove
 */
export const basicDatatypes: RosDatatypes = new Map();

for (const [name, def] of Object.entries(commonDefs)) {
  basicDatatypes.set(name, def);
}
for (const [name, def] of Object.entries(foxgloveDefs)) {
  basicDatatypes.set(name, def);
}
