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

import { ReactNode, useCallback } from "react";

import { AppSetting } from "@foxglove-studio/app/AppSetting";
import { isTypicalFilterName } from "@foxglove-studio/app/components/MessagePathSyntax/isTypicalFilterName";
import { useAppConfigurationValue } from "@foxglove-studio/app/hooks/useAppConfigurationValue";
import { format, formatDuration } from "@foxglove-studio/app/util/formatTime";

const DURATION_20_YEARS_SEC = 20 * 365 * 24 * 60 * 60;

function getArrow(x: number, y: number) {
  if (x === 0 && y === 0) {
    return;
  }
  return (
    <span style={{ transform: `rotate(${Math.atan2(-y, x)}rad)`, display: "inline-block" }}>→</span>
  );
}

export default function useGetItemStringWithTimezone(): (
  type: string,
  data: any,
  itemType: ReactNode,
  itemString: string,
) => ReactNode {
  const [timezone] = useAppConfigurationValue<string>(AppSetting.TIMEZONE);
  return useCallback(
    (type: string, data: any, itemType: ReactNode, itemString: string) =>
      getItemString(type, data, itemType, itemString, timezone),
    [timezone],
  );
}

function getItemString(
  _type: string,
  data: any,
  itemType: ReactNode,
  itemString: string,
  timezone?: string,
): ReactNode {
  const keys = Object.keys(data);
  if (keys.length === 2) {
    const { sec, nsec } = data;
    if (sec != undefined && nsec != undefined) {
      // Values "too small" to be absolute epoch-based times are probably relative durations.
      return sec < DURATION_20_YEARS_SEC ? (
        formatDuration(data)
      ) : (
        <span>{format(data, timezone)}</span>
      );
    }
  }

  // for vectors/points display length
  if (keys.length === 2) {
    const { x, y } = data;
    if (x != undefined && y != undefined) {
      const length = Math.sqrt(x * x + y * y);
      return (
        <span>
          norm = {length.toFixed(2)} {getArrow(x, y)}
        </span>
      );
    }
  }

  if (keys.length === 3) {
    const { x, y, z } = data;
    if (x != undefined && y != undefined && z != undefined) {
      const length = Math.sqrt(x * x + y * y + z * z);
      return (
        <span>
          norm = {length.toFixed(2)} {z === 0 ? getArrow(x, y) : undefined}
        </span>
      );
    }
  }

  // Surface typically-used keys directly in the object summary so the user doesn't have to expand it.
  const filterKeys = keys
    .filter(isTypicalFilterName)
    .map((key) => `${key}: ${data[key]}`)
    .join(", ");
  return (
    <span>
      {itemType} {filterKeys.length > 0 ? filterKeys : itemString}
    </span>
  );
}
