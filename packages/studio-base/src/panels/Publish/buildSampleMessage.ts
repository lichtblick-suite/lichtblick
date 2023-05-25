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

import { Immutable } from "@foxglove/studio";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

export const builtinSampleValues: Record<string, unknown> = {
  bool: false,
  int8: 0,
  uint8: 0,
  int16: 0,
  uint16: 0,
  int32: 0,
  uint32: 0,
  int64: 0,
  uint64: 0,
  float32: 0,
  float64: 0,
  string: "",
  time: { sec: 0, nsec: 0 },
  duration: { sec: 0, nsec: 0 },
};

export default function buildSampleMessage(
  datatypes: Immutable<RosDatatypes>,
  datatype: string,
): unknown | undefined {
  const builtin = builtinSampleValues[datatype];
  if (builtin != undefined) {
    return builtin;
  }
  const fields = datatypes.get(datatype)?.definitions;
  if (!fields) {
    return undefined;
  }
  const obj: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.isConstant ?? false) {
      continue;
    }
    const sample = buildSampleMessage(datatypes, field.type);
    if (field.isArray ?? false) {
      if (field.arrayLength != undefined) {
        obj[field.name] = new Array(field.arrayLength).fill(sample);
      } else {
        obj[field.name] = [sample];
      }
    } else {
      obj[field.name] = sample;
    }
  }
  return obj;
}
