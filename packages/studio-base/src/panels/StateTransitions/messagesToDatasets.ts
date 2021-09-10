// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import stringHash from "string-hash";

import { Time, toSec, subtract as subtractTimes } from "@foxglove/rostime";
import { ChartData } from "@foxglove/studio-base/components/Chart";
import { MessageAndData } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import {
  getTooltipItemForMessageHistoryItem,
  TimeBasedChartTooltipData,
} from "@foxglove/studio-base/components/TimeBasedChart";
import { darkColor, lineColors } from "@foxglove/studio-base/util/plotColors";
import { grey } from "@foxglove/studio-base/util/toolsColorScheme";

import positiveModulo from "./positiveModulo";
import { StateTransitionPath } from "./types";

type DatasetInfo = {
  datasets: ChartData["datasets"];
  tooltips: TimeBasedChartTooltipData[];
};

const baseColors = [grey, ...lineColors];

type Args = {
  path: StateTransitionPath;
  startTime: Time;
  y: number;
  pathIndex: number;
  blocks: readonly (readonly MessageAndData[] | undefined)[];
};

export default function messagesToDatasets(args: Args): DatasetInfo {
  const { path, startTime, y, pathIndex, blocks } = args;

  const info: DatasetInfo = {
    datasets: [],
    tooltips: [],
  };

  let prevQueryValue: string | number | boolean | undefined;
  let previousTimestamp: Time | undefined;
  let currentData: ChartData["datasets"][0]["data"] = [];

  for (const messages of blocks) {
    if (!messages) {
      currentData = [];
      prevQueryValue = undefined;
      previousTimestamp = undefined;
      continue;
    }

    for (const itemByPath of messages) {
      const item = getTooltipItemForMessageHistoryItem(itemByPath);
      const timestamp =
        path.timestampMethod === "headerStamp" ? item.headerStamp : item.receiveTime;
      if (!timestamp) {
        continue;
      }

      const queriedData = item.queriedData[0];
      if (item.queriedData.length !== 1 || !queriedData) {
        continue;
      }

      const { constantName, value } = queriedData;

      // Skip duplicates.
      if (
        previousTimestamp &&
        toSec(subtractTimes(previousTimestamp, timestamp)) === 0 &&
        prevQueryValue === value
      ) {
        continue;
      }
      previousTimestamp = timestamp;

      // Skip anything that cannot be cast to a number or is a string.
      if (Number.isNaN(value) && typeof value !== "string") {
        continue;
      }

      if (typeof value !== "number" && typeof value !== "boolean" && typeof value !== "string") {
        continue;
      }

      const valueForColor =
        typeof value === "string" ? stringHash(value) : Math.round(Number(value));
      const color =
        baseColors[positiveModulo(valueForColor, Object.values(baseColors).length)] ?? "grey";

      const x = toSec(subtractTimes(timestamp, startTime));

      const element = { x, y };

      const tooltip: TimeBasedChartTooltipData = {
        x,
        y,
        item,
        path: path.value,
        value,
        constantName,
        startTime,
      };
      info.tooltips.unshift(tooltip);

      // the current point is added even if different from previous value to avoid _gaps_ in the data
      // this is a byproduct of using separate datasets to render each color
      currentData.push({ x, y });

      // if the value is different from previous value, make a new dataset
      if (value !== prevQueryValue) {
        const label =
          constantName != undefined ? `${constantName} (${String(value)})` : String(value);

        const elementWithLabel = {
          ...element,
          label,
          labelColor: color,
        };

        // new data starts with our current point, the current point
        currentData = [elementWithLabel];
        const dataset: ChartData["datasets"][0] = {
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

        info.datasets.push(dataset);
      }

      prevQueryValue = value;
    }
  }

  return info;
}
