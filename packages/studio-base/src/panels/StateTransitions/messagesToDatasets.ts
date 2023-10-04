// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import stringHash from "string-hash";

import { Time, subtract as subtractTimes, toSec } from "@foxglove/rostime";
import { MessageAndData } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { ChartDataset, ChartDatasets } from "@foxglove/studio-base/components/TimeBasedChart/types";
import { expandedLineColors } from "@foxglove/studio-base/util/plotColors";
import { getTimestampForMessageEvent } from "@foxglove/studio-base/util/time";
import { grey } from "@foxglove/studio-base/util/toolsColorScheme";

import positiveModulo from "./positiveModulo";
import { StateTransitionPath } from "./types";

const baseColors = [grey, ...expandedLineColors];

/**
 * Returns a function that can be used to assign unique indexes to distinct values. Returns the
 * previous index if the value has been seen before otherwise a new index.
 */
function makeValueIndexer() {
  const seenValues = new Map<unknown, number>();
  return (val: unknown) => {
    const seen = seenValues.get(val);
    if (seen != undefined) {
      return seen;
    }
    seenValues.set(val, seenValues.size);
    return seenValues.size - 1;
  };
}

type Args = {
  path: StateTransitionPath;
  startTime: Time;
  y: number;
  pathIndex: number;
  blocks: readonly (readonly MessageAndData[] | undefined)[];
};

/**
 * Processes messages into datasets. For performance reasons all values are condensed into a single
 * dataset with different labels and colors applied per-point.
 */
export default function messagesToDatasets(args: Args): ChartDatasets {
  const { path, startTime, y, blocks } = args;

  const dataset: ChartDataset = {
    borderWidth: 10,
    data: [],
    label: path.label ? path.label : path.value,
    pointBackgroundColor: "rgba(0, 0, 0, 0.4)",
    pointBorderColor: "transparent",
    pointHoverRadius: 3,
    pointRadius: 1.25,
    pointStyle: "circle",
    showLine: true,
  };

  let previousTimestamp: Time | undefined;

  const indexer = makeValueIndexer();
  let lastDatasetIndex: undefined | number = undefined;

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

      const datasetIndex = indexer(value);

      // Skip duplicates.
      if (
        previousTimestamp &&
        toSec(subtractTimes(previousTimestamp, timestamp)) === 0 &&
        datasetIndex === lastDatasetIndex
      ) {
        continue;
      }
      previousTimestamp = timestamp;

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
      const color =
        baseColors[positiveModulo(valueForColor, Object.values(baseColors).length)] ?? "grey";

      const x = toSec(subtractTimes(timestamp, startTime));

      const label =
        constantName != undefined ? `${constantName} (${String(value)})` : String(value);

      const isNewSegment = datasetIndex !== lastDatasetIndex;

      const elementWithLabel = {
        x,
        y,
        label: isNewSegment ? label : "",
        labelColor: color,
        value,
        constantName,
      };

      dataset.data.push(elementWithLabel);

      lastDatasetIndex = datasetIndex;
    }
  }

  return [dataset];
}
