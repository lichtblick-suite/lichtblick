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
import { ChartOptions, ChartData, ScaleOptions, ScatterDataPoint } from "chart.js";
import { AnnotationOptions } from "chartjs-plugin-annotation";
import { ZoomOptions } from "chartjs-plugin-zoom/types/options";
import React, {
  memo,
  useEffect,
  useCallback,
  useState,
  useRef,
  ComponentProps,
  useMemo,
  MouseEvent,
} from "react";
import ReactDOM from "react-dom";
import { useDispatch } from "react-redux";
import { Time } from "rosbag";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";

import { clearHoverValue, setHoverValue } from "@foxglove-studio/app/actions/hoverValue";
import Button from "@foxglove-studio/app/components/Button";
import ChartComponent from "@foxglove-studio/app/components/Chart/index";
import { RpcElement, RpcScales } from "@foxglove-studio/app/components/Chart/types";
import KeyListener from "@foxglove-studio/app/components/KeyListener";
import {
  MessageAndData,
  MessagePathDataItem,
} from "@foxglove-studio/app/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useMessagePipeline } from "@foxglove-studio/app/components/MessagePipeline";
import TimeBasedChartLegend from "@foxglove-studio/app/components/TimeBasedChart/TimeBasedChartLegend";
import makeGlobalState from "@foxglove-studio/app/components/TimeBasedChart/makeGlobalState";
import mixins from "@foxglove-studio/app/styles/mixins.module.scss";
import { isBobject } from "@foxglove-studio/app/util/binaryObjects";
import filterMap from "@foxglove-studio/app/util/filterMap";
import { useDeepChangeDetector } from "@foxglove-studio/app/util/hooks";
import { defaultGetHeaderStamp } from "@foxglove-studio/app/util/synchronizeMessages";
import { maybeGetBobjectHeaderStamp } from "@foxglove-studio/app/util/time";

import HoverBar from "./HoverBar";
import TimeBasedChartTooltip from "./TimeBasedChartTooltip";

export type TooltipItem = {
  queriedData: MessagePathDataItem[];
  receiveTime: Time;
  headerStamp?: Time;
};

export const getTooltipItemForMessageHistoryItem = (item: MessageAndData): TooltipItem => {
  const { message } = item.message;
  const headerStamp = isBobject(message)
    ? maybeGetBobjectHeaderStamp(message)
    : defaultGetHeaderStamp(message);
  return { queriedData: item.queriedData, receiveTime: item.message.receiveTime, headerStamp };
};

export type TimeBasedChartTooltipData = {
  x: number;
  y: number | string;
  datasetKey?: string;
  item: TooltipItem;
  path: string;
  value: number | boolean | string;
  constantName?: string;
  startTime: Time;
  source?: number;
};

const SRoot = styled.div`
  position: relative;
`;

const SResetZoom = styled.div`
  position: absolute;
  bottom: 33px;
  right: 10px;
`;

const SLegend = styled.div`
  display: flex;
  width: 10%;
  min-width: 90px;
  overflow-y: auto;
  flex-direction: column;
  align-items: flex-start;
  justify-content: start;
  padding: 30px 0px 10px 0px;
`;

const SBar = styled.div<{ xAxisIsPlaybackTime: boolean }>`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 9px;
  margin-left: -4px;
  display: block;
  border-style: solid;
  border-color: #f7be00 transparent;
  background: ${(props) =>
    props.xAxisIsPlaybackTime ? "#F7BE00 padding-box" : "#248EFF padding-box"};
  border-width: ${(props) => (props.xAxisIsPlaybackTime ? "4px" : "0px 4px")};
`;

type FollowPlaybackState = Readonly<{
  xOffsetMin: number; // -1 means the left edge of the plot is one second before the current time.
  xOffsetMax: number; // 1 means the right edge of the plot is one second after the current time.
}>;

// Chartjs typings use _null_ to indicate _gaps_ in the dataset
// eslint-disable-next-line no-restricted-syntax
type Data = ChartData<"scatter", (ScatterDataPoint | null)[]>;
type DataSet = Data["datasets"][0];

// Exported for tests
export function filterDatasets(
  datasets: readonly DataSet[],
  linesToHide: {
    [key: string]: boolean;
  },
  width: number,
  height: number,
  bounds?: { x: { min: number; max: number }; y: { min: number; max: number } },
): DataSet[] {
  return filterMap(datasets, (dataset) => {
    const { label } = dataset;
    if ((label === undefined || linesToHide[label]) ?? false) {
      return;
    }

    // we don't have any bounds to filter the dataset on, it goes unfiltered
    if (!bounds) {
      // NaN item values are now allowed, instead we convert these to undefined entries
      // which will create _gaps_ in the line
      const nanToNulldata = dataset.data.map((item) => {
        if (item == undefined || isNaN(item.x) || isNaN(item.y)) {
          // Chartjs typings use _null_
          // eslint-disable-next-line no-restricted-syntax
          return null;
        }
        return item;
      });

      return { ...dataset, data: nanToNulldata };
    }

    const pixelPerXValue = width / (bounds.x.max - bounds.x.min);
    const pixelPerYValue = height / (bounds.y.max - bounds.y.min);

    let prev: ScatterDataPoint | undefined;
    const data = filterMap(dataset.data, (datum) => {
      if (!datum || isNaN(datum.x) || isNaN(datum.y)) {
        return datum;
      }

      if (!prev) {
        prev = datum;
        return datum;
      }

      const pixelXDistance = (datum.x - prev.x) * pixelPerXValue;
      const pixelYDistance = (datum.y - prev.y) * pixelPerYValue;

      if (pixelXDistance < 4 && pixelYDistance < 4) {
        return;
      }

      prev = datum;
      return datum;
    });

    // NaN item values are now allowed, instead we convert these to undefined entries
    // which will create _gaps_ in the line
    const nanToNulldata = data.map((item) => {
      if (item == undefined || isNaN(item.x) || isNaN(item.y)) {
        // Chartjs typings use _null_
        // eslint-disable-next-line no-restricted-syntax
        return null;
      }
      return item;
    });

    return { ...dataset, data: nanToNulldata };
  });
}

// only sync the x axis and allow y-axis scales to auto-calculate
type SyncBounds = { min: number; max: number; userInteraction: boolean };
const useGlobalXBounds = makeGlobalState<SyncBounds>();

// Calculation mode for the "reset view" view.
export type ChartDefaultView =
  | void // Zoom to fit
  | { type: "fixed"; minXValue: number; maxXValue: number }
  | { type: "following"; width: number };

export type Props = {
  type: "scatter";
  width: number;
  height: number;
  zoom: boolean;
  data: Data;
  tooltips?: TimeBasedChartTooltipData[];
  xAxes?: ScaleOptions;
  yAxes: ScaleOptions;
  annotations?: AnnotationOptions[];
  drawLegend?: boolean;
  isSynced?: boolean;
  canToggleLines?: boolean;
  toggleLine?: (datasetId: string | typeof undefined, lineToHide: string) => void;
  linesToHide?: {
    [key: string]: boolean;
  };
  datasetId?: string;
  onClick?: (
    ev: React.MouseEvent<HTMLCanvasElement>,
    datalabel: unknown,
    values: {
      [axis: string]: number;
    },
  ) => void;
  saveCurrentView?: (minY: number, maxY: number, width?: number) => void;
  // If the x axis represents playback time ("timestamp"), the hover cursor will be synced.
  // Note, this setting should not be used for other time values.
  xAxisIsPlaybackTime: boolean;
  plugins?: ChartOptions["plugins"];
  currentTime?: number;
  defaultView?: ChartDefaultView;
};

// Create a chart with any y-axis but with an x-axis that shows time since the
// start of the bag, and which is kept in sync with other instances of this
// component. Uses chart.js internally, with a zoom/pan plugin, and with our
// standard tooltips.
export default memo<Props>(function TimeBasedChart(props: Props) {
  const {
    datasetId,
    type,
    width,
    height,
    drawLegend,
    canToggleLines,
    toggleLine,
    data,
    isSynced = false,
    tooltips,
    yAxes,
    xAxes,
    defaultView,
    currentTime,
    xAxisIsPlaybackTime,
  } = props;

  const tooltipRef = useRef<HTMLDivElement>(ReactNull);
  const hasUnmounted = useRef<boolean>(false);
  const canvasContainer = useRef<HTMLDivElement>(ReactNull);

  const [hasUserPannedOrZoomed, setHasUserPannedOrZoomed] = useState<boolean>(false);
  const [followPlaybackState, setFollowPlaybackState] = useState<FollowPlaybackState | undefined>();

  const pauseFrame = useMessagePipeline(
    useCallback((messagePipeline) => messagePipeline.pauseFrame, []),
  );

  // when data changes, we pause and wait for onChartUpdate to resume
  const resumeFrame = useRef<() => void | undefined>();

  // resumes any paused frames
  // since we render in a web-worker we need to pause/resume the message pipeline to keep
  // our plot rendeirng in-sync with data rendered elsewhere in the app
  const onChartUpdate = useCallback(() => {
    const current = resumeFrame.current;
    resumeFrame.current = undefined;

    if (current) {
      // allow the chart offscreen canvas to render to screen
      requestAnimationFrame(current);
    }
  }, []);

  const hoverBar = useRef<HTMLDivElement>(ReactNull);
  const isUserInteraction = useRef(false);

  const [currentScales, setCurrentScales] = useState<RpcScales | undefined>();
  const [globalBounds, setGlobalBounds] = useGlobalXBounds({ enabled: isSynced });

  const { labels, datasets } = data;

  const linesToHide = useMemo(() => props.linesToHide ?? {}, [props.linesToHide]);

  useEffect(() => {
    // see notes for onChartUpdate
    resumeFrame.current = pauseFrame("TimeBasedChart");

    // cleanup pased frames on unmount or dataset changes
    return () => {
      onChartUpdate();
    };
  }, [pauseFrame, datasets, onChartUpdate]);

  // some callbacks don't need to re-create when the current scales change, so we keep a ref
  const currentScalesRef = useRef<RpcScales | undefined>(currentScales);
  useEffect(() => {
    currentScalesRef.current = currentScales;
  }, [currentScales]);

  // calculates the minX/maxX for all our datasets
  // we do this on the unfiltered datasets because we need the bounds to properly filter adjacent points
  const datasetXBounds = useMemo(() => {
    let min;
    let max;

    for (const dataset of datasets) {
      for (const item of dataset.data) {
        if (item == undefined || isNaN(item.x) || isNaN(item.y)) {
          continue;
        }
        min = Math.min(min ?? item.x, item.x);
        max = Math.max(max ?? item.x, item.x);
      }
    }

    // if the min/max are the same, let chart component decide the bounds
    // otherwise we end up with no x-axis
    if (min === max) {
      return;
    }

    if (min == undefined || max == undefined) {
      return;
    }

    return { min, max };
  }, [datasets]);

  // handle setting the sync value on updates to our scales
  useEffect(() => {
    // no need to update sync values if we are not syncing
    if (!isSynced || !currentScales?.x) {
      return;
    }

    // the change is a result of user interaction on our chart
    // we definitely set the sync scale value so other charts follow our zoom/pan behavior
    if (isUserInteraction.current) {
      setGlobalBounds({
        min: currentScales.x.min,
        max: currentScales.x.max,
        userInteraction: isUserInteraction.current,
      });
      return;
    }

    // the scales changed due to new data or another non-user initiated event
    // the sync value is conditionally set depending on the state of the existing sync value
    setGlobalBounds((old) => {
      // no scale from our plot, always use old value
      const xScale = currentScales?.x;
      if (!xScale) {
        return old;
      }

      // no old value for sync, initialize with our value
      if (!old) {
        return {
          min: xScale.min,
          max: xScale.max,
          userInteraction: false,
        };
      }

      // give preference to an old value set via user interaction
      // note that updates due to _our_ user interaction are set earlier
      if (old.userInteraction) {
        return old;
      }

      // calculate min/max based on old value and our new scale
      const newMin = Math.min(xScale.min, old.min);
      const newMax = Math.max(xScale.max, old.max);

      // avoid making a new sync object if the existing one matches our range
      // avoids infinite set states
      if (old.max === newMax && old.min === newMin) {
        return old;
      }

      // existing value does not match our new range, update the global sync value
      return {
        min: newMin,
        max: newMax,
        userInteraction: false,
      };
    });
  }, [isSynced, currentScales, setGlobalBounds]);

  const onResetZoom = useCallback(() => {
    setFollowPlaybackState(undefined);
    setHasUserPannedOrZoomed(false);

    // clearing the global bounds will make all panels reset to their data sets
    // which will cause all to re-sync to the min/max ranges for any panels without user interaction
    if (isSynced) {
      isUserInteraction.current = false;
      setGlobalBounds(undefined);
    }
  }, [isSynced, setGlobalBounds]);

  if (useDeepChangeDetector([defaultView], false)) {
    // Reset the view to the default when the default changes.
    if (hasUserPannedOrZoomed) {
      setHasUserPannedOrZoomed(false);
    }
    if (followPlaybackState != undefined) {
      setFollowPlaybackState(undefined);
    }
  }

  const [hasVerticalExclusiveZoom, setHasVerticalExclusiveZoom] = useState<boolean>(false);
  const [hasBothAxesZoom, setHasBothAxesZoom] = useState<boolean>(false);

  const zoomMode = useMemo<ZoomOptions["mode"]>(() => {
    if (hasVerticalExclusiveZoom) {
      return "y";
    } else if (hasBothAxesZoom) {
      return "xy";
    }
    return "x";
  }, [hasBothAxesZoom, hasVerticalExclusiveZoom]);

  const keyDownHandlers = React.useMemo(
    () => ({
      v: () => setHasVerticalExclusiveZoom(true),
      b: () => setHasBothAxesZoom(true),
    }),
    [setHasVerticalExclusiveZoom, setHasBothAxesZoom],
  );
  const keyUphandlers = React.useMemo(
    () => ({
      v: () => setHasVerticalExclusiveZoom(false),
      b: () => setHasBothAxesZoom(false),
    }),
    [setHasVerticalExclusiveZoom, setHasBothAxesZoom],
  );

  const removeTooltip = useCallback(() => {
    if (tooltipRef.current) {
      ReactDOM.unmountComponentAtNode(tooltipRef.current);
    }
    if (tooltipRef.current?.parentNode) {
      tooltipRef.current.parentNode.removeChild(tooltipRef.current);
      tooltipRef.current = ReactNull;
    }
  }, []);

  // Always clean up tooltips when unmounting.
  useEffect(() => {
    return () => {
      hasUnmounted.current = true;
      removeTooltip();
    };
  }, [removeTooltip]);

  // We use a custom tooltip so we can style it more nicely, and so that it can break
  // out of the bounds of the canvas, in case the panel is small.
  const updateTooltip = useCallback(
    (element?: RpcElement) => {
      // This is an async callback, so it can fire after this component is unmounted. Make sure that we remove the
      // tooltip if this fires after unmount.
      if (!element || hasUnmounted.current) {
        return removeTooltip();
      }

      // Locate the tooltip for our data
      // We do a lazy linear find for now - a perf on this vs map lookups might be useful
      // Note then you need to make keys from x/y points
      const tooltipData = tooltips?.find(
        (item) => item.x === element.data?.x && item.y === element.data?.y,
      );
      if (!tooltipData) {
        return removeTooltip();
      }

      if (!tooltipRef.current) {
        tooltipRef.current = document.createElement("div");
        canvasContainer.current?.parentNode?.appendChild(tooltipRef.current);
      }

      ReactDOM.render(
        <TimeBasedChartTooltip tooltip={tooltipData}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translate(${element.view.x}px, ${element.view.y}px)`,
            }}
          />
        </TimeBasedChartTooltip>,
        tooltipRef.current,
      );
    },
    [removeTooltip, tooltips],
  );

  const [hoverComponentId] = useState(() => uuidv4());
  const dispatch = useDispatch();
  const clearGlobalHoverTime = useCallback(
    () => dispatch(clearHoverValue({ componentId: hoverComponentId })),
    [dispatch, hoverComponentId],
  );
  const setGlobalHoverTime = useCallback(
    (value) =>
      dispatch(
        setHoverValue({
          componentId: hoverComponentId,
          value,
          type: xAxisIsPlaybackTime ? "PLAYBACK_SECONDS" : "OTHER",
        }),
      ),
    [dispatch, hoverComponentId, xAxisIsPlaybackTime],
  );

  const onMouseOut = useCallback(() => {
    removeTooltip();
    clearGlobalHoverTime();
  }, [clearGlobalHoverTime, removeTooltip]);

  // currentScalesRef is used because we don't need to change this callback content when the scales change
  // this does mean that scale changes don't remove tooltips - which is a future enhancement
  const onMouseMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const xScale = currentScalesRef.current?.x;
      if (!xScale || !canvasContainer.current) {
        removeTooltip();
        clearGlobalHoverTime();
        return;
      }

      const canvasContainerRect = canvasContainer.current.getBoundingClientRect();
      const mouseX = event.pageX - canvasContainerRect.left;
      const pixels = xScale.right - xScale.left;
      const range = xScale.max - xScale.min;
      const xVal = (range / pixels) * (mouseX - xScale.left) + xScale.min;

      const xInBounds = xVal >= xScale.min && xVal <= xScale.max;
      if (!xInBounds || isNaN(xVal)) {
        removeTooltip();
        clearGlobalHoverTime();
        return;
      }

      setGlobalHoverTime(xVal);
    },
    [setGlobalHoverTime, removeTooltip, clearGlobalHoverTime],
  );

  const plugins = useMemo<ChartOptions["plugins"]>(() => {
    const annotations: AnnotationOptions[] = [...(props.annotations ?? [])];

    if (currentTime != undefined) {
      annotations.push({
        type: "line",
        drawTime: "beforeDatasetsDraw",
        scaleID: "x",
        borderColor: "#aaa",
        borderWidth: 1,
        value: currentTime,
      });
    }

    return {
      decimation: {
        enabled: true,
      },
      legend: {
        display: false,
      },
      datalabels: {
        display: false,
      },
      tooltip: {
        intersect: false,
        mode: "x",
        enabled: false, // Disable native tooltips since we use custom ones.
      },
      zoom: {
        zoom: {
          enabled: props.zoom,
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
      ...props.plugins,
      annotation: { annotations },
    };
  }, [currentTime, props.annotations, props.plugins, props.zoom, zoomMode]);

  const xScale = useMemo<ScaleOptions>(() => {
    const defaultXTicksSettings: ScaleOptions["ticks"] = {
      font: {
        family: mixins.monospaceFont,
        size: 10,
      },
      color: "#eee",
      maxRotation: 0,
    };

    let min: number | undefined;
    let max: number | undefined;

    // if the user has interacted with our chart locally, we ignore any global sync or local data ranges
    if (!hasUserPannedOrZoomed) {
      // default to dataset bounds
      if (datasetXBounds) {
        min = datasetXBounds.min;
        max = datasetXBounds.max;
      }

      // if we are syncing and have global bounds there are two possibilities
      // 1. the global bounds are from user interaction, we use that unconditionally
      // 2. the global bounds are min/max with our dataset bounds
      if (isSynced && globalBounds) {
        if (globalBounds.userInteraction) {
          min = globalBounds.min;
          max = globalBounds.max;
        } else {
          min = Math.min(min ?? globalBounds.min, globalBounds.min);
          max = Math.max(max ?? globalBounds.max, globalBounds.max);
        }
      }
    }

    return {
      grid: { color: "rgba(255, 255, 255, 0.2)" },
      ...xAxes,
      ...{ min, max },
      ticks: {
        ...defaultXTicksSettings,
        ...xAxes?.ticks,
      },
    };
  }, [datasetXBounds, globalBounds, hasUserPannedOrZoomed, isSynced, xAxes]);

  // we don't sync the y-axis bounds
  const yScale = useMemo<ScaleOptions>(() => {
    const defaultYTicksSettings: ScaleOptions["ticks"] = {
      font: {
        family: mixins.monospaceFont,
        size: 10,
      },
      color: "#eee",
      padding: 0,
    };

    return {
      type: "linear",
      ...yAxes,
      ticks: {
        ...defaultYTicksSettings,
        ...yAxes.ticks,
      },
    } as ScaleOptions;
  }, [yAxes]);

  // changing the dataset bounds can change the current scales which then cache busts the
  // dataMemo which could then change the scales. This creates a state update cycle and slows down rendering.
  // Instead we
  const [bustDataMemo, setBustDataMemo] = useState(0);
  useEffect(() => {
    if (isUserInteraction.current) {
      setBustDataMemo((old) => ++old);
    }
  }, [currentScales]);

  // Filter the dataset down to what can be shows to the user
  // this ignores out of bounds points and points that are too close together
  // we use either automatically calculated bounds (xScale) or the currentScale
  // if the user is manually controlling the component
  const dataMemo = useMemo(() => {
    bustDataMemo; // to appease exchaustive lint hooks
    const currentScalesLocal = currentScalesRef.current;

    let bounds:
      | { x: { min: number; max: number }; y: { min: number; max: number } }
      | undefined = undefined;
    if (currentScalesLocal?.x && currentScalesLocal?.y) {
      bounds = {
        x: {
          min: currentScalesLocal.x.min,
          max: currentScalesLocal.x.max,
        },
        y: {
          min: currentScalesLocal.y.min,
          max: currentScalesLocal.y.max,
        },
      };
    }

    const filtered = filterDatasets(datasets, linesToHide, width, height, bounds);

    return {
      labels,
      datasets: filtered,
    };
  }, [bustDataMemo, datasets, linesToHide, width, height, labels]);

  const options = useMemo<ChartOptions>(() => {
    return {
      maintainAspectRatio: false,
      animation: { duration: 0 },
      // Disable splines, they seem to cause weird rendering artifacts:
      elements: { line: { tension: 0 } },
      hover: {
        intersect: false,
        mode: "x",
      },
      scales: {
        x: xScale,
        y: yScale,
      },
      plugins,
    };
  }, [plugins, xScale, yScale]);

  const onHover = useCallback(
    (elements: RpcElement[]) => {
      updateTooltip(elements[0]);
    },
    [updateTooltip],
  );

  const onScalesUpdate = useCallback((scales: RpcScales, { userInteraction }) => {
    isUserInteraction.current = userInteraction;
    if (userInteraction) {
      setHasUserPannedOrZoomed(true);
    }

    setCurrentScales(scales);
  }, []);

  // we don't memo this because either options or data is likely to change with each render
  // maybe one day someone perfs this and decides to memo?
  const chartProps: ComponentProps<typeof ChartComponent> = {
    type,
    width,
    height,
    options,
    data: dataMemo,
    onScalesUpdate: onScalesUpdate,
    onChartUpdate,
    onHover,
  };

  // avoid rendering if width/height are 0 - usually on initial mount
  // so we don't trigger onChartUpdate if we know we will immediately resize
  if (width === 0 || height === 0) {
    return ReactNull;
  }

  return (
    <div style={{ display: "flex", width: "100%" }}>
      <div style={{ display: "flex", width }}>
        <SRoot onDoubleClick={onResetZoom}>
          <HoverBar
            componentId={hoverComponentId}
            isTimestampScale={xAxisIsPlaybackTime}
            scales={currentScales}
          >
            <SBar xAxisIsPlaybackTime={xAxisIsPlaybackTime} ref={hoverBar} />
          </HoverBar>

          <div ref={canvasContainer} onMouseMove={onMouseMove} onMouseOut={onMouseOut}>
            <ChartComponent {...chartProps} />
          </div>

          {hasUserPannedOrZoomed && (
            <SResetZoom>
              <Button tooltip="(shortcut: double-click)" onClick={onResetZoom}>
                reset view
              </Button>
            </SResetZoom>
          )}
          <KeyListener global keyDownHandlers={keyDownHandlers} keyUpHandlers={keyUphandlers} />
        </SRoot>
      </div>
      {drawLegend === true && (
        <SLegend>
          <TimeBasedChartLegend
            datasetId={datasetId}
            canToggleLines={canToggleLines}
            datasets={data.datasets}
            linesToHide={linesToHide}
            toggleLine={toggleLine}
          />
        </SLegend>
      )}
    </div>
  );
});
