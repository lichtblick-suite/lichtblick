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

import { Button, styled as muiStyled, useTheme } from "@mui/material";
import { ChartOptions, ScaleOptions } from "chart.js";
import { flatten, pick, uniq } from "lodash";
import { ComponentProps, useCallback, useMemo, useState } from "react";
import { useResizeDetector } from "react-resize-detector";

import type { ZoomOptions } from "@foxglove/chartjs-plugin-zoom/types/options";
import { filterMap } from "@foxglove/den/collection";
import ChartComponent from "@foxglove/studio-base/components/Chart";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import KeyListener from "@foxglove/studio-base/components/KeyListener";
import MessagePathInput from "@foxglove/studio-base/components/MessagePathSyntax/MessagePathInput";
import { useMessageDataItem } from "@foxglove/studio-base/components/MessagePathSyntax/useMessageDataItem";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";
import useDeepChangeDetector from "@foxglove/studio-base/hooks/useDeepChangeDetector";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import { TwoDimensionalTooltip } from "./Tooltip";
import { safeParseFloat } from "./helpers";

const StyledButton = muiStyled(Button)(({ theme }) => ({
  position: "absolute",
  marginRight: theme.spacing(2.5),
  marginBottom: theme.spacing(7),
  bottom: 0,
  right: 0,
}));

const VALID_TYPES = ["message"];
const keysToPick = [
  "order",
  "label",
  "backgroundColor",
  "borderColor",
  "borderDash",
  "borderWidth",
  "pointBackgroundColor",
  "pointBorderColor",
  "pointBorderWidth",
  "pointRadius",
  "pointStyle",
  "lineTension",
  "data",
];

const messagePathInputStyle = { height: "100%" };

type Path = { value: string };
type Config = {
  path: Path;
  minXVal?: string;
  maxXVal?: string;
  minYVal?: string;
  maxYVal?: string;
  pointRadiusOverride?: string;
};
type Props = {
  config: Config;
  saveConfig: SaveConfig<Config>;
  onFinishRender?: () => void;
};
export type Line = {
  order?: number;
  label: string;
  backgroundColor?: string;
  borderColor?: string;
  borderDash?: number[];
  borderWidth?: number;
  pointBackgroundColor?: string;
  pointBorderColor?: string;
  pointBorderWidth?: number;
  pointRadius?: number;
  pointStyle?:
    | "circle"
    | "cross"
    | "crossRot"
    | "dash"
    | "line"
    | "rect"
    | "rectRounded"
    | "rectRot"
    | "star"
    | "triangle";
  lineTension?: number;
  data: { x: number; y: number }[];
};

type Data = ComponentProps<typeof ChartComponent>["data"];

export type PlotMessage = {
  lines: Line[];
  points?: Line[];
  polygons?: Line[];
  title?: string;
  yAxisLabel?: string;
  xAxisLabel?: string;
  gridColor?: string;
};

function TwoDimensionalPlot(props: Props) {
  const theme = useTheme();
  const { config, saveConfig, onFinishRender } = props;
  const { path, minXVal, maxXVal, minYVal, maxYVal, pointRadiusOverride } = config;
  const [hasUserPannedOrZoomed, setHasUserPannedOrZoomed] = React.useState<boolean>(false);
  const [hasVerticalExclusiveZoom, setHasVerticalExclusiveZoom] = React.useState<boolean>(false);
  const [hasBothAxesZoom, setHasBothAxesZoom] = React.useState<boolean>(false);

  const matchedMessages = useMessageDataItem(path.value);
  const message = matchedMessages[0]?.queriedData[0]?.value as PlotMessage | undefined;

  const { title, yAxisLabel, xAxisLabel, gridColor = theme.palette.divider } = message ?? {};

  const datasets = useMemo<Data["datasets"]>(() => {
    if (!message) {
      return [];
    }

    const { lines = [], points = [], polygons = [] } = message;

    const linesDatasets = filterMap(lines, (line) => {
      const { data, ...picked } = pick(line, keysToPick);
      if (data == undefined) {
        return undefined;
      }

      // since message might be a lazy message, we need to read the individual x/y fields from each item
      const dataPoints = data.map((item) => ({ x: item.x, y: item.y }));
      const dataset = { data: dataPoints, showLine: true, fill: false, ...picked };
      if (pointRadiusOverride != undefined) {
        dataset.pointRadius = parseFloat(pointRadiusOverride);
      }

      return dataset;
    });

    const pointsDatasets = filterMap(points, (point) => {
      const { data, ...picked } = pick(point, keysToPick);
      if (data == undefined) {
        return undefined;
      }

      // since message might be a lazy message, we need to read the individual x/y fields from each item
      const dataPoints = data.map((item) => ({ x: item.x, y: item.y }));
      const dataset = { data: dataPoints, showLine: true, fill: false, ...picked };
      if (pointRadiusOverride != undefined) {
        dataset.pointRadius = parseFloat(pointRadiusOverride);
      }

      return dataset;
    });

    const polygonDatasets = filterMap(polygons, (polygon) => {
      const { data, ...picked } = pick(polygon, keysToPick);
      if (data == undefined) {
        return undefined;
      }

      // since message might be a lazy message, we need to read the individual x/y fields from each item
      const dataPoints = data.map((item) => ({ x: item.x, y: item.y }));
      const closedData =
        dataPoints[0] != undefined ? dataPoints.concat([dataPoints[0]]) : dataPoints;
      const dataset = {
        data: closedData,
        fill: true,
        pointRadius: 0,
        showLine: true,
        lineTension: 0,
        ...picked,
      };

      return dataset;
    });

    const allDatasets = [...linesDatasets, ...pointsDatasets, ...polygonDatasets];
    return allDatasets.sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
  }, [message, pointRadiusOverride]);

  const { allXs, allYs } = useMemo(() => {
    const allPoints = filterMap(flatten(datasets.map((dataset) => dataset.data)), (pt) =>
      pt == undefined ? undefined : pt,
    );
    return {
      allXs: allPoints.map(({ x }) => x),
      allYs: allPoints.map(({ y }) => y),
    };
  }, [datasets]);

  const getBufferedMinMax = useCallback((allVals: number[]) => {
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);
    const diff = maxVal - minVal;
    return {
      min: diff === 0 ? minVal - 1 : minVal - diff * 0.05,
      max: diff === 0 ? maxVal + 1 : maxVal + diff * 0.05,
    };
  }, []);

  const yScale = useMemo<ScaleOptions>(() => {
    const min = safeParseFloat(minYVal);
    const max = safeParseFloat(maxYVal);
    const minMax = hasUserPannedOrZoomed
      ? undefined
      : {
          min: !isNaN(min) ? min : getBufferedMinMax(allYs).min,
          max: !isNaN(max) ? max : getBufferedMinMax(allYs).max,
        };
    return {
      grid: { color: gridColor },
      title: { display: yAxisLabel != undefined, text: yAxisLabel },
      ...minMax,
    };
  }, [allYs, getBufferedMinMax, gridColor, hasUserPannedOrZoomed, maxYVal, minYVal, yAxisLabel]);

  const xScale = useMemo<ScaleOptions>(() => {
    const min = safeParseFloat(minXVal);
    const max = safeParseFloat(maxXVal);
    const minMax = hasUserPannedOrZoomed
      ? undefined
      : {
          min: !isNaN(min) ? min : getBufferedMinMax(allXs).min,
          max: !isNaN(max) ? max : getBufferedMinMax(allXs).max,
        };

    return {
      grid: { color: gridColor },
      title: { display: xAxisLabel != undefined, text: xAxisLabel },
      ...minMax,
    };
  }, [allXs, getBufferedMinMax, gridColor, hasUserPannedOrZoomed, maxXVal, minXVal, xAxisLabel]);

  const zoomMode = useMemo<ZoomOptions["mode"]>(() => {
    if (hasVerticalExclusiveZoom) {
      return "y";
    } else if (hasBothAxesZoom) {
      return "xy";
    }
    return "x";
  }, [hasBothAxesZoom, hasVerticalExclusiveZoom]);

  const options = useMemo<ChartOptions>(
    () => ({
      scales: {
        y: yScale,
        x: xScale,
      },
      color: theme.palette.text.secondary,
      animation: { duration: 0 },
      plugins: {
        title: {
          display: title != undefined,
          text: title,
          color: theme.palette.text.primary,
        },
        tooltip: {
          intersect: false,
          mode: "nearest",
          enabled: false, // Disable native tooltips since we use custom ones.
        },
        datalabels: {
          display: false,
        },
        legend: { display: false },
        zoom: {
          zoom: {
            enabled: true,
            mode: zoomMode,
            sensitivity: 3,
            speed: 0.1,
          },
          pan: {
            mode: "xy",
            enabled: true,
            speed: 20,
            threshold: 10,
          },
        },
      },
    }),
    [theme, title, xScale, yScale, zoomMode],
  );

  const onScaleBoundsUpdate = useCallback((_: unknown, opt: { userInteraction: boolean }) => {
    if (opt.userInteraction) {
      setHasUserPannedOrZoomed(true);
    }
  }, []);

  const [activeTooltip, setActiveTooltip] = useState<{
    x: number;
    y: number;
    data: { x: number; y: number }[];
  }>();

  const tooltipElement = useMemo(() => {
    return <TwoDimensionalTooltip datapoints={activeTooltip?.data ?? []} />;
  }, [activeTooltip?.data]);

  const { tooltip } = useTooltip({
    shown: activeTooltip != undefined,
    noPointerEvents: true,
    targetPosition: { x: activeTooltip?.x ?? 0, y: activeTooltip?.y ?? 0 },
    contents: tooltipElement,
  });

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // an existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const {
    width = 0,
    height = 0,
    ref: resizeRef,
  } = useResizeDetector<HTMLDivElement>({
    refreshRate: 0,
    refreshMode: "debounce",
  });

  type CallbackType = NonNullable<ComponentProps<typeof ChartComponent>["onHover"]>;
  const onHover = useCallback<CallbackType>(
    (elements) => {
      const first = elements[0];
      if (!first) {
        setActiveTooltip(undefined);
        return;
      }

      const containerRect = resizeRef.current?.getBoundingClientRect();
      if (containerRect) {
        const data = filterMap(elements, (element) => element.data);
        setActiveTooltip({
          x: containerRect.left + first.view.x,
          y: containerRect.top + first.view.y,
          data,
        });
      }
    },
    [resizeRef],
  );

  const onResetZoom = useCallback(() => {
    setHasUserPannedOrZoomed(false);
  }, [setHasUserPannedOrZoomed]);

  if (
    useDeepChangeDetector([pick(props.config, ["minXVal", "maxXVal", "minYVal", "maxYVal"])], {
      initiallyTrue: false,
    })
  ) {
    // Reset the view to the default when the default changes.
    if (hasUserPannedOrZoomed) {
      setHasUserPannedOrZoomed(false);
    }
  }

  const keyDownHandlers = useMemo(
    () => ({
      v: () => setHasVerticalExclusiveZoom(true),
      b: () => setHasBothAxesZoom(true),
    }),
    [],
  );

  const keyUphandlers = useMemo(
    () => ({
      v: () => setHasVerticalExclusiveZoom(false),
      b: () => setHasBothAxesZoom(false),
    }),
    [setHasVerticalExclusiveZoom, setHasBothAxesZoom],
  );

  const onChange = useCallback<ComponentProps<typeof MessagePathInput>["onChange"]>(
    (value) => saveConfig({ path: { value } }),
    [saveConfig],
  );

  if (uniq(datasets.map(({ label }) => label)).length !== datasets.length) {
    throw new Error("2D Plot datasets do not have unique labels");
  }

  const data = useMemo(() => {
    return { datasets };
  }, [datasets]);

  const emptyMessage = datasets.length === 0;
  const emptyStateElement = useMemo(() => {
    if (!message) {
      return <EmptyState>Waiting for next message</EmptyState>;
    } else if (emptyMessage) {
      <EmptyState>No 2D Plot data (lines, points, polygons) to visualize</EmptyState>;
    }

    return undefined;
  }, [emptyMessage, message]);

  return (
    <Stack flex="auto" fullHeight>
      <PanelToolbar>
        <MessagePathInput
          path={path.value}
          onChange={onChange}
          inputStyle={messagePathInputStyle}
          validTypes={VALID_TYPES}
          placeholder="Select topic messages with 2D Plot data to visualize"
          autoSize
        />
      </PanelToolbar>
      <Stack
        ref={resizeRef}
        direction="row"
        flex="auto"
        fullWidth
        overflow="hidden"
        position="relative"
      >
        {emptyStateElement ? (
          emptyStateElement
        ) : (
          <>
            {tooltip}
            <ChartComponent
              type="scatter"
              width={width}
              height={height}
              options={options}
              onScalesUpdate={onScaleBoundsUpdate}
              onHover={onHover}
              data={data}
              onFinishRender={onFinishRender}
            />
            {hasUserPannedOrZoomed && (
              <StyledButton
                data-testid="reset-zoom"
                variant="contained"
                color="inherit"
                title="(shortcut: double-click)"
                onClick={onResetZoom}
              >
                Reset view
              </StyledButton>
            )}
            <KeyListener global keyDownHandlers={keyDownHandlers} keyUpHandlers={keyUphandlers} />
          </>
        )}
      </Stack>
    </Stack>
  );
}

const defaultConfig: Config = { path: { value: "" } };

export default Panel(
  Object.assign(TwoDimensionalPlot, {
    panelType: "TwoDimensionalPlot",
    defaultConfig,
  }),
);
