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

import { ScaleOptions } from "chart.js";
import { AnnotationOptions } from "chartjs-plugin-annotation";
import { ComponentProps, useMemo } from "react";
import { useResizeDetector } from "react-resize-detector";

import { filterMap } from "@foxglove/den/collection";
import TimeBasedChart, {
  Props as TimeBasedChartProps,
  ChartDefaultView,
  TimeBasedChartTooltipData,
} from "@foxglove/studio-base/components/TimeBasedChart";
import { lineColors } from "@foxglove/studio-base/util/plotColors";

import { PlotXAxisVal } from "./index";
import { PlotPath, isReferenceLinePlotPathType } from "./internalTypes";

// A "reference line" plot path is a numeric value. It creates a horizontal line on the plot at the specified value.
function getAnnotationFromReferenceLine(path: PlotPath, index: number): AnnotationOptions {
  const borderColor = lineColors[index % lineColors.length] ?? "#DDDDDD";
  return {
    type: "line",
    display: true,
    drawTime: "beforeDatasetsDraw",
    scaleID: "y",
    label: { content: path.value, width: "100%", height: "100%" },
    borderColor,
    borderDash: [5, 5],
    borderWidth: 1,
    value: Number.parseFloat(path.value),
  };
}

function getAnnotations(paths: PlotPath[]) {
  return filterMap(paths, (path: PlotPath, index: number) => {
    if (!path.enabled) {
      return undefined;
    } else if (isReferenceLinePlotPathType(path)) {
      return getAnnotationFromReferenceLine(path, index);
    }
    return undefined;
  });
}

type PlotChartProps = {
  isSynced: boolean;
  paths: PlotPath[];
  minYValue: number;
  maxYValue: number;
  datasets: ComponentProps<typeof TimeBasedChart>["data"]["datasets"];
  tooltips: TimeBasedChartTooltipData[];
  xAxisVal: PlotXAxisVal;
  currentTime?: number;
  defaultView?: ChartDefaultView;
  onClick?: TimeBasedChartProps["onClick"];
};
export default function PlotChart(props: PlotChartProps): JSX.Element {
  const {
    paths,
    currentTime,
    defaultView,
    minYValue,
    maxYValue,
    datasets,
    onClick,
    isSynced,
    tooltips,
    xAxisVal,
  } = props;

  const annotations = useMemo(() => getAnnotations(paths), [paths]);

  const yAxes = useMemo((): ScaleOptions => {
    const min = isNaN(minYValue) ? undefined : minYValue;
    const max = isNaN(maxYValue) ? undefined : maxYValue;
    return {
      min,
      max,
      ticks: {
        precision: 3,
      },
      grid: {
        color: "rgba(255, 255, 255, 0.2)",
      },
    };
  }, [maxYValue, minYValue]);

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // and existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const {
    width,
    height,
    ref: sizeRef,
  } = useResizeDetector({
    refreshRate: 0,
    refreshMode: "debounce",
  });

  const data = useMemo(() => {
    return { datasets };
  }, [datasets]);

  return (
    <div style={{ width: "100%", flexGrow: 1, overflow: "hidden", padding: "2px" }} ref={sizeRef}>
      <TimeBasedChart
        key={xAxisVal}
        isSynced={isSynced}
        zoom
        width={width ?? 0}
        height={height ?? 0}
        data={data}
        tooltips={tooltips}
        annotations={annotations}
        type="scatter"
        yAxes={yAxes}
        xAxisIsPlaybackTime={xAxisVal === "timestamp"}
        currentTime={currentTime}
        defaultView={defaultView}
        onClick={onClick}
      />
    </div>
  );
}
