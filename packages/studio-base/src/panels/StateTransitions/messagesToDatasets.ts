// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import stringHash from "string-hash";

import { Time, toSec, subtract as subtractTimes } from "@foxglove/rostime";
import { MessageAndData } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import {
  ChartDataset,
  ChartDatasets,
  ChartDatum,
} from "@foxglove/studio-base/components/TimeBasedChart/types";
import { darkColor, expandedLineColors } from "@foxglove/studio-base/util/plotColors";
import { getTimestampForMessageEvent } from "@foxglove/studio-base/util/time";
import { grey } from "@foxglove/studio-base/util/toolsColorScheme";

import positiveModulo from "./positiveModulo";
import { StateTransitionPath } from "./types";

const baseColors = [grey, ...expandedLineColors];

type Args = {
  path: StateTransitionPath;
  startTime: Time;
  y: number;
  pathIndex: number;
  blocks: readonly (readonly MessageAndData[] | undefined)[];
};

export default function messagesToDatasets(args: Args): ChartDatasets {
  const { path, pathIndex, startTime, y, blocks } = args;

  const datasets = [];

  let previousTimestamp: Time | undefined;
  let currentData: ChartDatum[] = [];

  const datasetIndexMap = new Map<unknown, number>();
  let lastDatasetIndex: undefined | number = undefined;

  for (const messages of blocks) {
    if (!messages) {
      currentData.push({ x: NaN, y: NaN });
      lastDatasetIndex = undefined;
      previousTimestamp = undefined;
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

      const datasetIndex = datasetIndexMap.get(value);

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

      // If the value maps to a different dataset than the last value, close the previous segment
      // and insert a gap.
      const newSegment = datasetIndex !== lastDatasetIndex;
      if (newSegment) {
        currentData.push({ x, y });
        currentData.push({ x: NaN, y: NaN });
      }
      const label =
        constantName != undefined ? `${constantName} (${String(value)})` : String(value);
      if (datasetIndex == undefined) {
        datasetIndexMap.set(value, datasets.length);
        const elementWithLabel = {
          x,
          y,
          label,
          labelColor: color,
          value,
          constantName,
        };

        // new data starts with our current point, the current point
        currentData = [elementWithLabel];
        const dataset: ChartDataset = {
          borderWidth: 10,
          borderColor: color,
          data: currentData,
          label: pathIndex.toString(),
          pointBackgroundColor: darkColor(color),
          pointBorderColor: "transparent",
          pointHoverRadius: 3,
          pointRadius: 1.25,
          pointStyle: "circle",
          showLine: true,
          datalabels: {
            color,
          },
        };

        lastDatasetIndex = datasets.length;
        datasets.push(dataset);
      } else {
        currentData = datasets[datasetIndex]?.data ?? [];
        if (newSegment) {
          currentData.push({
            x,
            y,
            label,
            labelColor: color,
            value,
            constantName,
          });
        } else {
          currentData.push({ x, y, value, constantName });
        }
        lastDatasetIndex = datasetIndex;
      }
    }
  }

  return datasets;
}
