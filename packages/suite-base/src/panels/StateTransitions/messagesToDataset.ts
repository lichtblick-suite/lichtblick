// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import stringHash from "string-hash";

import { subtract as subtractTimes, toSec } from "@lichtblick/rostime";
import {
  MessageAndData,
  MessagePathDataItem,
} from "@lichtblick/suite-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { ChartDataset } from "@lichtblick/suite-base/components/TimeBasedChart/types";
import { expandedLineColors } from "@lichtblick/suite-base/util/plotColors";
import { getTimestampForMessageEvent } from "@lichtblick/suite-base/util/time";

import positiveModulo from "./positiveModulo";
import { MessageDatasetArgs, ValidQueriedDataValue } from "./types";

export const baseColors = [...expandedLineColors];
const baseColorsLength = Object.values(baseColors).length;

/**
 * Processes messages into datasets. For performance reasons all values are condensed into a single
 * dataset with different labels and colors applied per-point.
 */
export function messagesToDataset(args: MessageDatasetArgs): ChartDataset {
  const { path, startTime, y, blocks, showPoints } = args;

  const dataset: ChartDataset = {
    borderWidth: 10,
    data: [],
    label: path.label ?? path.value,
    pointBackgroundColor: "rgba(0, 0, 0, 0.4)",
    pointBorderColor: "transparent",
    pointHoverRadius: 3,
    pointRadius: showPoints ? 1.25 : 0,
    pointStyle: "circle",
    showLine: true,
  };

  let lastValue: string | number | bigint | boolean | undefined = undefined;
  let lastDatum: ChartDataset["data"][0] | undefined = undefined;

  for (const messages of blocks) {
    if (!messages) {
      continue;
    }

    for (const itemByPath of messages) {
      const timestamp = getTimestampForMessageEvent(itemByPath.messageEvent, path.timestampMethod);
      if (!timestamp) {
        continue;
      }

      const queriedData = extractQueriedData(itemByPath);
      if (!queriedData) {
        continue;
      }

      const { constantName, value } = queriedData;

      if (!isValidValue(value)) {
        continue;
      }

      const color = getColor(value);
      const x = toSec(subtractTimes(timestamp, startTime));
      const label = createLabel(constantName, value);

      const isNewSegment = lastValue !== value;

      lastValue = value;
      lastDatum = {
        x,
        y,
        label: isNewSegment ? label : undefined,
        labelColor: color,
        value,
        constantName,
      };

      if (isNewSegment || showPoints) {
        dataset.data.push(lastDatum);

        // after we add a datum we clear the last datum so we don't try to add it again at the end
        lastDatum = undefined;
      }
    }
  }

  // If we never added the last datum (maybe because it was the same state as before), we add
  // it to the data so the user sees the state going until this point.
  if (lastDatum != undefined) {
    dataset.data.push(lastDatum);
  }

  return dataset;
}

export function extractQueriedData(itemByPath: MessageAndData): MessagePathDataItem | undefined {
  if (itemByPath.queriedData.length === 1) {
    return itemByPath.queriedData[0];
  }
  return undefined;
}

export function isValidValue(value: unknown): value is number | string | bigint | boolean {
  // Check if the type of `value` is one of the desired types and that it's not `NaN`
  return (
    (typeof value === "number" && !Number.isNaN(value)) ||
    typeof value === "string" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  );
}

export function getColor(value: ValidQueriedDataValue): string {
  const valueForColor = typeof value === "string" ? stringHash(value) : Math.round(Number(value));
  return baseColors[positiveModulo(valueForColor, baseColorsLength)]!;
}

export function createLabel(
  constantName: string | undefined,
  value: ValidQueriedDataValue,
): string {
  return constantName != undefined ? `${constantName} (${String(value)})` : String(value);
}
