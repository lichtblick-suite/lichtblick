// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ScatterDataPoint } from "chart.js";
import stringHash from "string-hash";

import { Time, toSec, subtract as subtractTimes } from "@foxglove/rostime";
import { ChartData } from "@foxglove/studio-base/components/Chart";
import { MessageAndData } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { TimeBasedChartTooltipData } from "@foxglove/studio-base/components/TimeBasedChart";
import { darkColor, expandedLineColors } from "@foxglove/studio-base/util/plotColors";
import { getTimestampForMessageEvent } from "@foxglove/studio-base/util/time";
import { grey } from "@foxglove/studio-base/util/toolsColorScheme";

import positiveModulo from "./positiveModulo";
import { StateTransitionPath } from "./types";

type DatasetInfo = {
  datasets: ChartData["datasets"];
  tooltips: TimeBasedChartTooltipData[];
};

type Dataset = ChartData["datasets"][number];
type DatasetData = ChartData["datasets"][number]["data"];

const baseColors = [grey, ...expandedLineColors];

type Args = {
  path: StateTransitionPath;
  startTime: Time;
  y: number;
  pathIndex: number;
  blocks: readonly (readonly MessageAndData[] | undefined)[];
};

export default function messagesToDatasets(args: Args): DatasetInfo {
  const { path, pathIndex, startTime, y, blocks } = args;

  const info: DatasetInfo = {
    datasets: [],
    tooltips: [],
  };

  let previousTimestamp: Time | undefined;
  let currentData: DatasetData = [];

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

      const tooltip: TimeBasedChartTooltipData = {
        datasetIndex,
        x,
        y,
        value,
        constantName,
      };
      info.tooltips.unshift(tooltip);

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
        datasetIndexMap.set(value, info.datasets.length);
        const elementWithLabel = {
          x,
          y,
          label,
          labelColor: color,
        };

        // new data starts with our current point, the current point
        currentData = [elementWithLabel];
        const dataset: Dataset = {
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

        lastDatasetIndex = info.datasets.length;
        info.datasets.push(dataset);
      } else {
        currentData = info.datasets[datasetIndex]?.data ?? [];
        if (newSegment) {
          currentData.push({ x, y, label, labelColor: color } as ScatterDataPoint);
        } else {
          currentData.push({ x, y });
        }
        lastDatasetIndex = datasetIndex;
      }
    }
  }

  return info;
}
