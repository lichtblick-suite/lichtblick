// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ChartDatum } from "@lichtblick/suite-base/components/TimeBasedChart/types";
import { ValueAtTime } from "@lichtblick/suite-base/panels/StateTransitions/types";

/** Finds the state active at `time`, assuming `data` is sorted by `x` ascending (message order). */
export function getValueAtTime(
  data: readonly (ChartDatum | undefined)[],
  time: number,
): ValueAtTime | undefined {
  let result: ValueAtTime | undefined;

  for (const datum of data) {
    if (!datum) {
      continue;
    }
    if (datum.x > time) {
      break;
    }
    // A datum with no value marks a gap in the data - there is no active state until the next point.
    result =
      datum.value != undefined
        ? { value: datum.value, constantName: datum.constantName }
        : undefined;
  }

  return result;
}
