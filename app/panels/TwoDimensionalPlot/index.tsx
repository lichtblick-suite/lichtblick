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

import { flatten, pick, round, uniq } from "lodash";
import * as React from "react";
import DocumentEvents from "react-document-events";
import ReactDOM from "react-dom";
import styled from "styled-components";

import helpContent from "./index.help.md";
import Button from "@foxglove-studio/app/components/Button";
import Dimensions from "@foxglove-studio/app/components/Dimensions";
import EmptyState from "@foxglove-studio/app/components/EmptyState";
import Flex from "@foxglove-studio/app/components/Flex";
import KeyListener from "@foxglove-studio/app/components/KeyListener";
import { Item } from "@foxglove-studio/app/components/Menu";
import MessagePathInput from "@foxglove-studio/app/components/MessagePathSyntax/MessagePathInput";
import { useLatestMessageDataItem } from "@foxglove-studio/app/components/MessagePathSyntax/useLatestMessageDataItem";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import ChartComponent, { HoveredElement } from "@foxglove-studio/app/components/ReactChartjs";
import { ScaleBounds } from "@foxglove-studio/app/components/ReactChartjs/zoomAndPanHelpers";
import Tooltip from "@foxglove-studio/app/components/Tooltip";
import { cast } from "@foxglove-studio/app/players/types";
import {
  PanelToolbarLabel,
  PanelToolbarInput,
} from "@foxglove-studio/app/shared/panelToolbarStyles";
import { deepParse, isBobject } from "@foxglove-studio/app/util/binaryObjects";
import { useDeepChangeDetector } from "@foxglove-studio/app/util/hooks";
import { colors, ROBOTO_MONO } from "@foxglove-studio/app/util/sharedStyleConstants";

const SResetZoom = styled.div`
  position: absolute;
  bottom: 15px;
  right: 10px;
`;

const SContainer = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
`;

const SRoot = styled.div`
  display: flex;
  flex: 1 1 auto;
  width: 100%;
  overflow: hidden;
  position: relative;
`;

// TODO: Autocomplete should only show paths that actually match the format this panel supports
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

const isValidMinMaxVal = (val?: string) => {
  return val == null || val === "" || !isNaN(parseFloat(val));
};

type Path = { value: string };
type Config = {
  path: Path;
  minXVal?: string;
  maxXVal?: string;
  minYVal?: string;
  maxYVal?: string;
  pointRadiusOverride?: string;
};
type Props = { config: Config; saveConfig: (arg0: Partial<Config>) => void };
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

const SWrapper = styled.div`
  top: 0;
  bottom: 0;
  position: absolute;
  pointer-events: none;
  will-change: transform;
  // "visibility" and "transform" are set by JS, but outside of React.
  visibility: hidden;
`;

const SBar = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 9px;
  margin-left: -4px;
  display: block;
  border-style: solid;
  border-color: #f7be00 transparent;
  background: #f7be00 padding-box;
  border-width: 4px;
`;

type Position = { x: number; y: number };

type HoverBarProps = {
  children?: React.ReactNode;
  mousePosition?: Position;
};

function hideBar(wrapper: any) {
  if (wrapper.style.visibility !== "hidden") {
    wrapper.style.visibility = "hidden";
  }
}

function showBar(wrapper: any, position: number) {
  wrapper.style.visibility = "visible";
  wrapper.style.transform = `translateX(${position}px)`;
}

// TODO: It'd be a lot more performant to draw directly to the canvas here
// instead of using React state lifecycles to update the hover bar.
const HoverBar = React.memo<HoverBarProps>(function HoverBar({
  children,
  mousePosition,
}: HoverBarProps) {
  const wrapper = React.useRef<HTMLDivElement | null>(null);
  // We avoid putting the visibility and transforms into react state to try to keep updates snappy.
  // Mouse interactions are frequent, and adding/removing the bar from the DOM would slow things
  // down a lot more than mutating the style props does.
  if (wrapper.current != null) {
    const { current } = wrapper;
    if (mousePosition != null) {
      showBar(current, mousePosition.x);
    } else {
      hideBar(current);
    }
  }

  return <SWrapper ref={wrapper}>{children}</SWrapper>;
});

type TooltipProps = {
  datapoints: { datapoint: Position; label: string; backgroundColor?: string }[];
  xAxisLabel?: string;
  tooltipElement?: HoveredElement;
};

const TwoDimensionalTooltip = ({ datapoints, xAxisLabel, tooltipElement }: TooltipProps) => {
  if (!tooltipElement) {
    return null;
  }

  const contents = (
    <div style={{ fontFamily: ROBOTO_MONO }}>
      <div style={{ color: colors.TEXT_MUTED, padding: "4px 0" }}>
        {xAxisLabel}: {round(tooltipElement.data.x, 5)}
      </div>
      {datapoints
        .sort((a, b) => b.datapoint.y - a.datapoint.y)
        .map(({ datapoint, label, backgroundColor }, i) => {
          return (
            <div key={i} style={{ padding: "4px 0", display: "flex", alignItems: "center" }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  backgroundColor: backgroundColor || colors.GRAY,
                  marginRight: "2px",
                }}
              />
              <div>
                {label}: {round(datapoint.y, 5)}
              </div>
            </div>
          );
        })}
    </div>
  );
  return (
    <Tooltip defaultShown placement="top" contents={contents}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `translate(${tooltipElement.view.x}px, ${tooltipElement.view.y}px)`,
        }}
      />
    </Tooltip>
  );
};

// NOTE: Keep this type (and its dependencies) in sync with the corresponding
// Node Playground types in 'userUtils'.
export type PlotMessage = {
  lines: Line[];
  points?: Line[];
  polygons?: Line[];
  title?: string;
  yAxisLabel?: string;
  xAxisLabel?: string;
  gridColor?: string;
};

type MenuContentProps = {
  config: Config;
  saveConfig: (arg0: Partial<Config>) => void;
};
function MenuContent({ config, saveConfig }: MenuContentProps) {
  const { pointRadiusOverride, minXVal, maxXVal, minYVal, maxYVal } = config;
  return (
    <>
      <Item>
        <Flex>
          <Flex col style={{ maxWidth: 100, marginRight: 5 }}>
            <PanelToolbarLabel>Min X</PanelToolbarLabel>
            <PanelToolbarInput
              style={isValidMinMaxVal(minXVal) ? {} : { color: colors.REDL1 }}
              value={minXVal}
              onChange={({ target }) => saveConfig({ minXVal: target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="auto"
            />
          </Flex>
          <Flex col style={{ maxWidth: 100 }}>
            <PanelToolbarLabel>Max X</PanelToolbarLabel>
            <PanelToolbarInput
              style={isValidMinMaxVal(maxXVal) ? {} : { color: colors.REDL1 }}
              value={maxXVal}
              onChange={({ target }) => saveConfig({ maxXVal: target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="auto"
            />
          </Flex>
        </Flex>
      </Item>
      <Item>
        <Flex>
          <Flex col style={{ maxWidth: 100, marginRight: 5 }}>
            <PanelToolbarLabel>Min Y</PanelToolbarLabel>
            <PanelToolbarInput
              style={isValidMinMaxVal(minYVal) ? {} : { color: colors.REDL1 }}
              value={minYVal}
              onChange={({ target }) => saveConfig({ minYVal: target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="auto"
            />
          </Flex>
          <Flex col style={{ maxWidth: 100 }}>
            <PanelToolbarLabel>Max Y</PanelToolbarLabel>
            <PanelToolbarInput
              style={isValidMinMaxVal(maxYVal) ? {} : { color: colors.REDL1 }}
              value={maxYVal}
              onChange={({ target }) => saveConfig({ maxYVal: target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="auto"
            />
          </Flex>
        </Flex>
      </Item>
      <Item>
        <PanelToolbarLabel>Point Radius Override</PanelToolbarLabel>
        <PanelToolbarInput
          value={pointRadiusOverride}
          onChange={({ target }) => saveConfig({ pointRadiusOverride: target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="auto"
        />
      </Item>
    </>
  );
}

function TwoDimensionalPlot(props: Props) {
  const { config, saveConfig } = props;
  const { path, minXVal, maxXVal, minYVal, maxYVal, pointRadiusOverride }: any = config;
  const [hasUserPannedOrZoomed, setHasUserPannedOrZoomed] = React.useState<boolean>(false);
  const [hasVerticalExclusiveZoom, setHasVerticalExclusiveZoom] = React.useState<boolean>(false);
  const [hasBothAxesZoom, setHasBothAxesZoom] = React.useState<boolean>(false);
  const tooltip = React.useRef<HTMLDivElement | null>(null);
  const chartComponent = React.useRef<ChartComponent | null>(null);

  const [mousePosition, setMousePosition] = React.useState<{ x: number; y: number } | undefined>();

  const maybeBobject: unknown = useLatestMessageDataItem(path.value, "bobjects")?.queriedData[0]
    ?.value;
  const message: PlotMessage | undefined = isBobject(maybeBobject)
    ? deepParse(maybeBobject)
    : cast<PlotMessage>(maybeBobject);
  const { title, yAxisLabel, xAxisLabel, gridColor, lines = [], points = [], polygons = [] } =
    message || {};
  const datasets = React.useMemo(
    () =>
      message
        ? [
            ...lines.map((line) => {
              const l: any = { ...pick(line, keysToPick), showLine: true, fill: false };
              if (pointRadiusOverride) {
                l.pointRadius = pointRadiusOverride;
              }

              return l;
            }),
            ...points.map((point) => {
              const pt: any = pick(point, keysToPick);
              if (pointRadiusOverride) {
                pt.pointRadius = pointRadiusOverride;
              }
              return pt;
            }),
            ...polygons.map((polygon) => ({
              ...pick(polygon, keysToPick),
              data: polygon.data[0] ? polygon.data.concat([polygon.data[0]]) : polygon.data,
              fill: true,
              pointRadius: 0,
              showLine: true,
              lineTension: 0,
            })),
          ].sort((a, b) => (b.order || 0) - (a.order || 0))
        : [],
    [lines, message, pointRadiusOverride, points, polygons],
  );

  const { allXs, allYs } = React.useMemo(
    () => ({
      allXs: flatten(
        datasets.map((dataset) => (dataset.data ? dataset.data.map(({ x }: any) => x) : [])),
      ),
      allYs: flatten(
        datasets.map((dataset) => (dataset.data ? dataset.data.map(({ y }: any) => y) : [])),
      ),
    }),
    [datasets],
  );

  const getBufferedMinMax = React.useCallback((allVals: number[]) => {
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);
    const diff = maxVal - minVal;
    return {
      min: !diff ? minVal - 1 : minVal - diff * 0.05,
      max: !diff ? maxVal + 1 : maxVal + diff * 0.05,
    };
  }, []);

  const options = React.useMemo(
    () => ({
      title: { display: !!title, text: title },
      scales: {
        yAxes: [
          {
            gridLines: { color: gridColor },
            scaleLabel: { display: !!yAxisLabel, labelString: yAxisLabel },
            ticks: hasUserPannedOrZoomed
              ? {}
              : {
                  min: parseFloat(minYVal) ? parseFloat(minYVal) : getBufferedMinMax(allYs).min,
                  max: parseFloat(maxYVal) ? parseFloat(maxYVal) : getBufferedMinMax(allYs).max,
                },
          },
        ],
        xAxes: [
          {
            gridLines: { color: gridColor },
            scaleLabel: { display: !!xAxisLabel, labelString: xAxisLabel },
            ticks: hasUserPannedOrZoomed
              ? {}
              : {
                  min: parseFloat(minXVal) ? parseFloat(minXVal) : getBufferedMinMax(allXs).min,
                  max: parseFloat(maxXVal) ? parseFloat(maxXVal) : getBufferedMinMax(allXs).max,
                },
          },
        ],
      },
      color: colors.GRAY,
      animation: { duration: 0 },
      legend: { display: false },
      pan: { enabled: true },
      zoom: { enabled: true },
      plugins: {},
    }),
    [
      allXs,
      allYs,
      getBufferedMinMax,
      gridColor,
      hasUserPannedOrZoomed,
      maxXVal,
      maxYVal,
      minXVal,
      minYVal,
      title,
      xAxisLabel,
      yAxisLabel,
    ],
  );

  const menuContent = React.useMemo(() => <MenuContent config={config} saveConfig={saveConfig} />, [
    config,
    saveConfig,
  ]);

  const removeTooltip = React.useCallback(() => {
    if (tooltip.current) {
      ReactDOM.unmountComponentAtNode(tooltip.current);
    }
    if (tooltip.current && tooltip.current.parentNode) {
      // Satisfy flow.
      tooltip.current.parentNode.removeChild(tooltip.current);
      tooltip.current = null;
    }
  }, []);

  const scaleBounds = React.useRef<readonly ScaleBounds[] | undefined>();
  const hoverBar = React.useRef<HTMLDivElement | null>(null);

  const onScaleBoundsUpdate = React.useCallback(
    (scales) => {
      scaleBounds.current = scales;
      const firstYScale = scales.find(({ axes }: any) => axes === "yAxes");
      if (firstYScale != null && hoverBar.current != null) {
        const { current } = hoverBar;
        const topPx = Math.min(firstYScale.minAlongAxis, firstYScale.maxAlongAxis);
        const bottomPx = Math.max(firstYScale.minAlongAxis, firstYScale.maxAlongAxis);
        current.style.top = `${topPx}px`;
        current.style.height = `${bottomPx - topPx}px`;
      }
    },
    [scaleBounds],
  );

  const onMouseMove = React.useCallback(
    async (event: MouseEvent) => {
      const currentChartComponent = chartComponent.current;
      if (!currentChartComponent || !currentChartComponent.canvas) {
        removeTooltip();
        return;
      }
      const { canvas } = currentChartComponent;
      const canvasRect = canvas.getBoundingClientRect();
      const isTargetingCanvas = event.target === canvas;
      const xMousePosition = event.pageX - canvasRect.left;
      const yMousePosition = event.pageY - canvasRect.top;

      if (
        event.pageX < canvasRect.left ||
        event.pageX > canvasRect.right ||
        event.pageY < canvasRect.top ||
        event.pageY > canvasRect.bottom ||
        !isTargetingCanvas
      ) {
        removeTooltip();
        setMousePosition(undefined);
        return;
      }

      const newMousePosition = { x: xMousePosition, y: yMousePosition };
      setMousePosition(newMousePosition);

      const tooltipElement = await currentChartComponent.getElementAtXAxis(event);
      if (!tooltipElement) {
        removeTooltip();
        return;
      }
      const tooltipDatapoints = [];
      for (const { data: dataPoints, label, backgroundColor } of datasets) {
        const datapoint = dataPoints.find(
          (_datapoint: any) => _datapoint.x === tooltipElement.data.x,
        );
        if (datapoint) {
          tooltipDatapoints.push({
            datapoint,
            label,
            backgroundColor,
          });
        }
      }
      if (!tooltipDatapoints.length) {
        removeTooltip();
        return;
      }

      if (!tooltip.current) {
        tooltip.current = document.createElement("div");
        if (canvas.parentNode) {
          canvas.parentNode.appendChild(tooltip.current);
        }
      }

      const currentTooltip = tooltip.current;
      if (currentTooltip) {
        ReactDOM.render(
          <TwoDimensionalTooltip
            tooltipElement={tooltipElement}
            datapoints={tooltipDatapoints}
            xAxisLabel={xAxisLabel}
          />,
          currentTooltip,
        );
      }
    },
    [datasets, removeTooltip, xAxisLabel],
  );

  const onResetZoom = React.useCallback(() => {
    if (chartComponent.current) {
      chartComponent.current.resetZoom();
      setHasUserPannedOrZoomed(false);
    }
  }, [setHasUserPannedOrZoomed]);

  const onPanZoom = React.useCallback(() => {
    if (!hasUserPannedOrZoomed) {
      setHasUserPannedOrZoomed(true);
    }
  }, [hasUserPannedOrZoomed]);
  if (
    useDeepChangeDetector([pick(props.config, ["minXVal", "maxXVal", "minYVal", "maxYVal"])], false)
  ) {
    // Reset the view to the default when the default changes.
    if (hasUserPannedOrZoomed) {
      setHasUserPannedOrZoomed(false);
    }
  }

  let zoomMode = "x";
  if (hasVerticalExclusiveZoom) {
    zoomMode = "y";
  } else if (hasBothAxesZoom) {
    zoomMode = "xy";
  }

  const keyDownHandlers = React.useMemo(
    () => ({
      v: () => setHasVerticalExclusiveZoom(true),
      b: () => setHasBothAxesZoom(true),
    }),
    [],
  );

  const keyUphandlers = React.useMemo(
    () => ({
      v: () => setHasVerticalExclusiveZoom(false),
      b: () => setHasBothAxesZoom(false),
    }),
    [setHasVerticalExclusiveZoom, setHasBothAxesZoom],
  );

  // Always clean up tooltips when unmounting.
  React.useEffect(() => removeTooltip, [removeTooltip]);
  const emptyMessage = !points.length && !lines.length && !polygons.length;

  if (uniq(datasets.map(({ label }) => label)).length !== datasets.length) {
    throw new Error("2D Plot datasets do not have unique labels");
  }

  const onChange = React.useCallback((newValue) => saveConfig({ path: { value: newValue } }), [
    saveConfig,
  ]);
  return (
    <SContainer>
      <PanelToolbar helpContent={helpContent} menuContent={menuContent}>
        <MessagePathInput
          path={path.value}
          onChange={onChange}
          inputStyle={messagePathInputStyle}
          validTypes={VALID_TYPES}
          placeholder="Select topic messages with 2D Plot data to visualize"
          autoSize
        />
      </PanelToolbar>
      {!message ? (
        <EmptyState>Waiting for next message</EmptyState>
      ) : emptyMessage ? (
        <EmptyState>No 2D Plot data (lines, points, polygons) to visualize</EmptyState>
      ) : (
        <SRoot onDoubleClick={onResetZoom}>
          <Dimensions>
            {({ width, height }) => (
              <>
                <HoverBar mousePosition={mousePosition}>
                  <SBar ref={hoverBar} />
                </HoverBar>
                <ChartComponent
                  ref={chartComponent}
                  type="scatter"
                  width={width}
                  height={height}
                  key={`${width}x${height}`}
                  options={options}
                  onPanZoom={onPanZoom}
                  onScaleBoundsUpdate={onScaleBoundsUpdate}
                  data={{ datasets }}
                  zoomOptions={{
                    ...ChartComponent.defaultProps.zoomOptions,
                    mode: zoomMode as any,
                  }}
                />
                {hasUserPannedOrZoomed && (
                  <SResetZoom>
                    <Button tooltip="(shortcut: double-click)" onClick={onResetZoom}>
                      reset view
                    </Button>
                  </SResetZoom>
                )}
              </>
            )}
          </Dimensions>
          <DocumentEvents
            capture
            onMouseDown={onMouseMove}
            onMouseUp={onMouseMove}
            onMouseMove={onMouseMove}
          />
          <KeyListener global keyDownHandlers={keyDownHandlers} keyUpHandlers={keyUphandlers} />
        </SRoot>
      )}
    </SContainer>
  );
}

TwoDimensionalPlot.panelType = "TwoDimensionalPlot";
TwoDimensionalPlot.defaultConfig = { path: { value: "" } };

export default Panel<Config>(TwoDimensionalPlot as any);
