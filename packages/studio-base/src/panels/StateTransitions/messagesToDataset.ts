// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import stringHash from "string-hash";

import { Time, subtract as subtractTimes, toSec } from "@foxglove/rostime";
import { MessageAndData } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { ChartDataset } from "@foxglove/studio-base/components/TimeBasedChart/types";
import { expandedLineColors } from "@foxglove/studio-base/util/plotColors";
import { getTimestampForMessageEvent } from "@foxglove/studio-base/util/time";
import { grey } from "@foxglove/studio-base/util/toolsColorScheme";

import positiveModulo from "./positiveModulo";
import { StateTransitionPath } from "./types";

const baseColors = [...expandedLineColors];
const baseColorsLength = Object.values(baseColors).length;

type Args = {
  path: StateTransitionPath;
  startTime: Time;
  y: number;
  pathIndex: number;
  blocks: readonly (readonly MessageAndData[] | undefined)[];
  showPoints: boolean;
};

/**
 * Processes messages into datasets. For performance reasons all values are condensed into a single
 * dataset with different labels and colors applied per-point.
 */
export function messagesToDataset(args: Args): ChartDataset {
  const { path, startTime, y, blocks, showPoints } = args;

  const dataset: ChartDataset = {
    borderWidth: 10,
    data: [],
    label: path.label ? path.label : path.value,
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

      const queriedData = itemByPath.queriedData[0];
      if (itemByPath.queriedData.length !== 1 || !queriedData) {
        continue;
      }

      const { constantName, value } = queriedData;

      // Skip anything that cannot be cast to a number or is a string.
      if (Number.isNaN(value) && typeof value !== "string") {
        continue;
      }

      if (
        typeof value !== "number" &&
        typeof value !== "bigint" &&
        typeof value !== "boolean" &&
        typeof value !== "string"
      ) {
        continue;
      }

      const valueForColor =
        typeof value === "string" ? stringHash(value) : Math.round(Number(value));
      const color = baseColors[positiveModulo(valueForColor, baseColorsLength)] ?? grey;

      const x = toSec(subtractTimes(timestamp, startTime));

      const label =
        constantName != undefined ? `${constantName} (${String(value)})` : String(value);

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
