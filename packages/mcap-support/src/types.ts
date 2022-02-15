// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RosMsgDefinition } from "@foxglove/rosmsg";

/** RosDatatypes is a map of datatype name to the datatype definition */
export type RosDatatypes = Map<string, RosMsgDefinition>;
