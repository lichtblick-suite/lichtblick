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

import { useTheme } from "@mui/material";
import { ScaleOptions } from "chart.js";
import { AnnotationOptions } from "chartjs-plugin-annotation";
import { ComponentProps, useMemo } from "react";
import { useResizeDetector } from "react-resize-detector";

import { filterMap } from "@foxglove/den/collection";
import TimeBasedChart, {
  ChartDefaultView,
  Props as TimeBasedChartProps,
} from "@foxglove/studio-base/components/TimeBasedChart";
import { getLineColor } from "@foxglove/studio-base/util/plotColors";

import { PlotPath, PlotXAxisVal, isReferenceLinePlotPathType } from "./internalTypes";
import { PlotData } from "./plotData";

// A "reference line" plot path is a numeric value. It creates a horizontal line on the plot at the specified value.
function getAnnotationFromReferenceLine(path: PlotPath, index: number): AnnotationOptions {
  const borderColor = getLineColor(path.color, index);
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
  showXAxisLabels: boolean;
  showYAxisLabels: boolean;
  datasets: ComponentProps<typeof TimeBasedChart>["data"]["datasets"];
  datasetBounds: PlotData["bounds"];
  xAxisVal: PlotXAxisVal;
  currentTime?: number;
  defaultView?: ChartDefaultView;
  onClick?: TimeBasedChartProps["onClick"];
};
export default function PlotChart(props: PlotChartProps): JSX.Element {
  const theme = useTheme();
  const {
    currentTime,
    datasetBounds,
    datasets,
    defaultView,
    isSynced,
    maxYValue,
    minYValue,
    onClick,
    paths,
    showXAxisLabels,
    showYAxisLabels,
    xAxisVal,
  } = props;

  const annotations = useMemo(() => getAnnotations(paths), [paths]);

  const yAxes = useMemo((): ScaleOptions<"linear"> => {
    const min = isNaN(minYValue) ? undefined : minYValue;
    const max = isNaN(maxYValue) ? undefined : maxYValue;
    return {
      min,
      max,
      ticks: {
        display: showYAxisLabels,
        precision: 3,
      },
      grid: {
        color: theme.palette.divider,
      },
    };
  }, [maxYValue, minYValue, showYAxisLabels, theme]);

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // an existing resize observation.
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
        dataBounds={datasetBounds}
        annotations={annotations}
        type="scatter"
        yAxes={yAxes}
        xAxisIsPlaybackTime={xAxisVal === "timestamp"}
        showXAxisLabels={showXAxisLabels}
        currentTime={currentTime}
        defaultView={defaultView}
        onClick={onClick}
      />
    </div>
  );
}
