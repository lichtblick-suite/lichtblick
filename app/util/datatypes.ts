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

import { RosMsgDefinition } from "@foxglove/rosmsg";
import { definitions } from "@foxglove/rosmsg-msgs-common";
import { RosDatatype, RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

function objectMap<T1, T2>(
  object: Record<string, T1>,
  mapFn: (key: string, value: T1) => T2,
): Record<string, T2> {
  return Object.keys(object).reduce((result, key) => {
    result[key] = mapFn(key, object[key] as T1);
    return result;
  }, {} as Record<string, T2>);
}

export const basicDatatypes: RosDatatypes = objectMap<RosMsgDefinition, RosDatatype>(
  definitions,
  (_, { definitions: fields }) => ({ fields }),
);
