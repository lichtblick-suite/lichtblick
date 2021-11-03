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
import { useTheme } from "@fluentui/react";
import { ChartOptions, ScaleOptions } from "chart.js";
import { AnnotationOptions } from "chartjs-plugin-annotation";
import { ZoomOptions } from "chartjs-plugin-zoom/types/options";
import React, {
  useEffect,
  useCallback,
  useState,
  useRef,
  ComponentProps,
  useMemo,
  MouseEvent,
} from "react";
import { useMountedState, useThrottle } from "react-use";
import styled from "styled-components";
import { useDebouncedCallback } from "use-debounce";
import { v4 as uuidv4 } from "uuid";

import { filterMap } from "@foxglove/den/collection";
import Logger from "@foxglove/log";
import { Time } from "@foxglove/rostime";
import Button from "@foxglove/studio-base/components/Button";
import ChartComponent from "@foxglove/studio-base/components/Chart/index";
import { RpcElement, RpcScales } from "@foxglove/studio-base/components/Chart/types";
import KeyListener from "@foxglove/studio-base/components/KeyListener";
import {
  MessageAndData,
  MessagePathDataItem,
} from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { useMessagePipeline } from "@foxglove/studio-base/components/MessagePipeline";
import TimeBasedChartLegend from "@foxglove/studio-base/components/TimeBasedChart/TimeBasedChartLegend";
import makeGlobalState from "@foxglove/studio-base/components/TimeBasedChart/makeGlobalState";
import Tooltip from "@foxglove/studio-base/components/Tooltip";
import {
  useClearHoverValue,
  useSetHoverValue,
} from "@foxglove/studio-base/context/HoverValueContext";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";
import { getTimestampForMessage } from "@foxglove/studio-base/util/time";

import HoverBar from "./HoverBar";
import TimeBasedChartTooltipContent from "./TimeBasedChartTooltipContent";
import { downsampleTimeseries, downsampleScatter } from "./downsample";

const log = Logger.getLogger(__filename);

export type TooltipItem = {
  queriedData: MessagePathDataItem[];
  receiveTime: Time;
  headerStamp?: Time;
};

export const getTooltipItemForMessageHistoryItem = (item: MessageAndData): TooltipItem => {
  const { message } = item.message;
  const headerStamp = getTimestampForMessage(message);
  return { queriedData: item.queriedData, receiveTime: item.message.receiveTime, headerStamp };
};

export type TimeBasedChartTooltipData = {
  x: number | bigint;
  y: number | bigint;
  datasetKey?: string;
  item: TooltipItem;
  path: string;
  value: number | bigint | boolean | string;
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
  width: 1px;
  margin-left: -1px;
  display: block;
  background-color: ${(props) => (props.xAxisIsPlaybackTime ? "#F7BE00" : "#248EFF")};
`;

type ChartComponentProps = ComponentProps<typeof ChartComponent>;

// Chartjs typings use _null_ to indicate _gaps_ in the dataset
// eslint-disable-next-line no-restricted-syntax
const ChartNull = null;

// only sync the x axis and allow y-axis scales to auto-calculate
type SyncBounds = { min: number; max: number; sourceId: string; userInteraction: boolean };
const useGlobalXBounds = makeGlobalState<SyncBounds>();

// Calculation mode for the "reset view" view.
export type ChartDefaultView =
  | { type: "fixed"; minXValue: number; maxXValue: number }
  | { type: "following"; width: number };

export type Props = {
  type: "scatter";
  width: number;
  height: number;
  zoom: boolean;
  data: ChartComponentProps["data"];
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
  onClick?: ChartComponentProps["onClick"];
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
export default function TimeBasedChart(props: Props): JSX.Element {
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

  const { labels, datasets } = data;

  const theme = useTheme();
  const componentId = useMemo(() => uuidv4(), []);
  const isMounted = useMountedState();
  const canvasContainer = useRef<HTMLDivElement>(ReactNull);

  const [hasUserPannedOrZoomed, setHasUserPannedOrZoomed] = useState<boolean>(false);

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
      // allow the chart offscreen canvas to render to screen before calling done
      requestAnimationFrame(current);
    }
  }, []);

  const hoverBar = useRef<HTMLDivElement>(ReactNull);

  const [globalBounds, setGlobalBounds] = useGlobalXBounds({ enabled: isSynced });

  const linesToHide = useMemo(() => props.linesToHide ?? {}, [props.linesToHide]);

  useEffect(() => {
    // cleanup paused frames on unmount or dataset changes
    return () => {
      onChartUpdate();
    };
  }, [pauseFrame, onChartUpdate]);

  // some callbacks don't need to re-create when the current scales change, so we keep a ref
  const currentScalesRef = useRef<RpcScales | undefined>(undefined);

  // calculates the minX/maxX for all our datasets
  // we do this on the unfiltered datasets because we need the bounds to properly filter adjacent points
  const datasetBounds = useMemo(() => {
    let xMin: number | undefined;
    let xMax: number | undefined;
    let yMin: number | undefined;
    let yMax: number | undefined;

    for (const dataset of datasets) {
      for (const item of dataset.data) {
        if (item == undefined) {
          continue;
        }
        if (!isNaN(item.x)) {
          xMin = Math.min(xMin ?? item.x, item.x);
          xMax = Math.max(xMax ?? item.x, item.x);
        }

        if (!isNaN(item.x)) {
          yMin = Math.min(yMin ?? item.y, item.y);
          yMax = Math.max(yMax ?? item.y, item.y);
        }
      }
    }

    return { x: { min: xMin, max: xMax }, y: { min: yMin, max: yMax } };
  }, [datasets]);

  // avoid re-doing a downsample on every scale change, instead mark the downsample as dirty
  // with a debounce and if downsampling hasn't happened after some time, trigger a downsample via state update
  const [invalidateDownsample, setDownsampleFlush] = useState({});
  const queueDownsampleInvalidate = useDebouncedCallback(
    () => {
      setDownsampleFlush({});
    },
    100,
    // maxWait equal to debounce timeout makes the debounce act like a throttle
    // Without a maxWait - invocations of the debounced invalidate reset the countdown
    // resulting in no invalidation when scales are constantly changing (playback)
    { leading: false, maxWait: 100 },
  );

  const onResetZoom = () => {
    setHasUserPannedOrZoomed(false);
    setGlobalBounds(undefined);
  };

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

  // We use a custom tooltip so we can style it more nicely, and so that it can break
  // out of the bounds of the canvas, in case the panel is small.
  const [activeTooltip, setActiveTooltip] = useState<{
    x: number;
    y: number;
    data: TimeBasedChartTooltipData;
  }>();
  const updateTooltip = useCallback(
    (element?: RpcElement) => {
      if (!element) {
        return setActiveTooltip(undefined);
      }

      // Locate the tooltip for our data
      // We do a lazy linear find for now - a perf on this vs map lookups might be useful
      // Note then you need to make keys from x/y points
      const tooltipData = tooltips?.find(
        (item) => Number(item.x) === element.data?.x && Number(item.y) === element.data?.y,
      );
      if (!tooltipData) {
        return setActiveTooltip(undefined);
      }

      const canvasRect = canvasContainer.current?.getBoundingClientRect();
      if (canvasRect) {
        setActiveTooltip({
          x: canvasRect.left + element.view.x,
          y: canvasRect.top + element.view.y,
          data: tooltipData,
        });
      }
    },
    [tooltips],
  );

  const setHoverValue = useSetHoverValue();
  const clearHoverValue = useClearHoverValue();
  const clearGlobalHoverTime = useCallback(
    () => clearHoverValue(componentId),
    [clearHoverValue, componentId],
  );

  const onMouseOut = useCallback(() => {
    setActiveTooltip(undefined);
    clearGlobalHoverTime();
  }, [clearGlobalHoverTime]);

  // currentScalesRef is used because we don't need to change this callback content when the scales change
  // this does mean that scale changes don't remove tooltips - which is a future enhancement
  const onMouseMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const xScale = currentScalesRef.current?.x;
      if (!xScale || !canvasContainer.current) {
        setActiveTooltip(undefined);
        clearGlobalHoverTime();
        return;
      }

      const canvasContainerRect = canvasContainer.current.getBoundingClientRect();
      const mouseX = event.pageX - canvasContainerRect.left;
      const pixels = xScale.pixelMax - xScale.pixelMin;
      const range = xScale.max - xScale.min;
      const xVal = (range / pixels) * (mouseX - xScale.pixelMin) + xScale.min;

      const xInBounds = xVal >= xScale.min && xVal <= xScale.max;
      if (!xInBounds || isNaN(xVal)) {
        setActiveTooltip(undefined);
        clearGlobalHoverTime();
        return;
      }

      setHoverValue({
        componentId,
        value: xVal,
        type: xAxisIsPlaybackTime ? "PLAYBACK_SECONDS" : "OTHER",
      });
    },
    [setHoverValue, componentId, xAxisIsPlaybackTime, clearGlobalHoverTime],
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
        algorithm: "lttb",
      },
      legend: {
        display: false,
      },
      datalabels: {
        display: false,
      },
      tooltip: {
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
    } as ChartOptions["plugins"];
  }, [currentTime, props.annotations, props.plugins, props.zoom, zoomMode]);

  // To avoid making a new xScale identity on all updates that might change the min/max
  // we memo the min/max X values so only when the values change is the scales object re-made
  const { min: minX, max: maxX } = useMemo(() => {
    // when unlocking sync keep the last manually panned/zoomed chart state
    if (!globalBounds && hasUserPannedOrZoomed) {
      return { min: undefined, max: undefined };
    }

    // if the aren't syncing bounds or if the bounds are from our own component, then we
    // unset the min/max and allow the chart to control the bounds
    if (globalBounds?.sourceId === componentId) {
      return { min: undefined, max: undefined };
    }

    let min: number | undefined;
    let max: number | undefined;

    // default view possibly gives us some initial bounds
    if (defaultView?.type === "fixed") {
      min = defaultView.minXValue;
      max = defaultView.maxXValue;
    } else if (defaultView?.type === "following") {
      max = currentTime ?? 0;
      min = max - defaultView.width;
    } else {
      min = datasetBounds.x.min;
      max = datasetBounds.x.max;
    }

    // if we are syncing and have global bounds there are two possibilities
    // 1. the global bounds are from user interaction, we use that unconditionally
    // 2. the global bounds are min/max with our dataset bounds
    if (globalBounds) {
      if (globalBounds.userInteraction) {
        min = globalBounds.min;
        max = globalBounds.max;
      } else if (defaultView?.type !== "following") {
        // if following and no user interaction - we leave our bounds as they are
        min = Math.min(min ?? globalBounds.min, globalBounds.min);
        max = Math.max(max ?? globalBounds.max, globalBounds.max);
      }
    }

    // if the min/max are the same, use undefined to fall-back to chart component auto-scales
    // without this the chart axis does not appear since it has as 0 size
    if (min === max) {
      return { min: undefined, max: undefined };
    }

    return { min, max };
  }, [
    currentTime,
    datasetBounds.x.max,
    datasetBounds.x.min,
    defaultView,
    globalBounds,
    componentId,
    hasUserPannedOrZoomed,
  ]);

  const xScale = useMemo<ScaleOptions>(() => {
    const defaultXTicksSettings: ScaleOptions["ticks"] = {
      font: {
        family: fonts.MONOSPACE,
        size: 10,
      },
      color: theme.palette.neutralSecondary,
      maxRotation: 0,
    };

    const scale = {
      grid: { color: theme.palette.neutralLighter },
      ...xAxes,
      min: minX,
      max: maxX,
      ticks: {
        ...defaultXTicksSettings,
        ...xAxes?.ticks,
      },
    };

    return scale;
  }, [theme.palette.neutralSecondary, theme.palette.neutralLighter, xAxes, minX, maxX]);

  const yScale = useMemo<ScaleOptions>(() => {
    const defaultYTicksSettings: ScaleOptions["ticks"] = {
      font: {
        family: fonts.MONOSPACE,
        size: 10,
      },
      color: theme.palette.neutralSecondary,
      padding: 0,
    };

    let minY;
    let maxY;

    if (!hasUserPannedOrZoomed) {
      // we prefer user specified bounds over dataset bounds
      minY = yAxes.min;
      maxY = yAxes.max;

      // chartjs doesn't like it when only one of min/max are specified for scales
      // so if either is specified then we specify both
      if (maxY == undefined && minY != undefined) {
        maxY = datasetBounds.y.max;
      }
      if (minY == undefined && maxY != undefined) {
        minY = datasetBounds.y.min;
      }
    }

    return {
      type: "linear",
      ...yAxes,
      min: minY,
      max: maxY,
      ticks: {
        ...defaultYTicksSettings,
        ...yAxes.ticks,
      },
    } as ScaleOptions;
  }, [datasetBounds.y, yAxes, hasUserPannedOrZoomed, theme.palette.neutralSecondary]);

  const datasetBoundsRef = useRef(datasetBounds);
  datasetBoundsRef.current = datasetBounds;
  const downsampleDatasets = useCallback(
    (fullDatasets: typeof datasets) => {
      const currentScales = currentScalesRef.current;
      let bounds:
        | {
            width: number;
            height: number;
            x: { min: number; max: number };
            y: { min: number; max: number };
          }
        | undefined = undefined;
      if (currentScales?.x && currentScales?.y) {
        bounds = {
          width,
          height,
          x: {
            min: currentScales.x.min,
            max: currentScales.x.max,
          },
          y: {
            min: currentScales.y.min,
            max: currentScales.y.max,
          },
        };
      }

      const dataBounds = datasetBoundsRef.current;

      // if we don't have bounds (chart not initialized) but do have dataset bounds
      // then setup bounds as x/y min/max around the dataset values rather than the scales
      if (
        !bounds &&
        dataBounds.x.min != undefined &&
        dataBounds.x.max != undefined &&
        dataBounds.y.min != undefined &&
        dataBounds.y.max != undefined
      ) {
        bounds = {
          width,
          height,
          x: {
            min: dataBounds.x.min,
            max: dataBounds.x.max,
          },
          y: {
            min: dataBounds.y.min,
            max: dataBounds.y.max,
          },
        };
      }

      // If we don't have any bounds - we assume the component is still initializing and return no data
      // The other alternative is to return the full data set. This leads to rendering full fidelity data
      // which causes render pauses and blank charts for large data sets.
      if (!bounds) {
        return [];
      }

      return fullDatasets.map((dataset) => {
        if (!bounds) {
          return dataset;
        }

        const downsampled =
          dataset.showLine !== true
            ? downsampleScatter(dataset, bounds)
            : downsampleTimeseries(dataset, bounds);
        // NaN item values are now allowed, instead we convert these to undefined entries
        // which will create _gaps_ in the line
        const nanToNulldata = downsampled.data.map((item) => {
          if (item == undefined || isNaN(item.x) || isNaN(item.y)) {
            // Chartjs typings use _null_ to indicate a gap
            return ChartNull;
          }
          return item;
        });

        return { ...downsampled, data: nanToNulldata };
      });
    },
    [height, width],
  );

  // remove datasets that should be hidden
  const visibleDatasets = useMemo(() => {
    return filterMap(datasets, (dataset) => {
      const { label } = dataset;
      if ((label == undefined || linesToHide[label]) ?? false) {
        return;
      }
      return dataset;
    });
  }, [datasets, linesToHide]);

  // throttle the downsampleDatasets callback since this is an input to the downsampledData memo
  // avoids down a downsample if the callback changes rapidly
  const throttledDownsample = useThrottle(() => downsampleDatasets, 100);

  // downsample datasets with the latest downsample function
  const downsampledDatasets = useMemo(() => {
    void invalidateDownsample;

    return throttledDownsample(visibleDatasets);
  }, [invalidateDownsample, throttledDownsample, visibleDatasets]);

  const downsampledData = useMemo(() => {
    if (resumeFrame.current) {
      if (process.env.NODE_ENV === "development") {
        log.warn("force resumed paused frame");
      }
      resumeFrame.current();
    }
    // during streaming the message pipeline should not give us any more data until we finish
    // rendering this update
    resumeFrame.current = pauseFrame("TimeBasedChart");

    return {
      labels,
      datasets: downsampledDatasets,
    };
  }, [pauseFrame, labels, downsampledDatasets]);

  const options = useMemo<ChartOptions>(() => {
    return {
      maintainAspectRatio: false,
      animation: false,
      // Disable splines, they seem to cause weird rendering artifacts:
      elements: { line: { tension: 0 } },
      interaction: {
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
      // onHover could fire after component unmounts so we need to guard with mounted checks
      if (isMounted()) {
        updateTooltip(elements[0]);
      }
    },
    [isMounted, updateTooltip],
  );

  const onScalesUpdate = useCallback(
    (scales: RpcScales, { userInteraction }: { userInteraction: boolean }) => {
      if (!isMounted()) {
        return;
      }

      if (userInteraction) {
        setHasUserPannedOrZoomed(true);
      }

      currentScalesRef.current = scales;

      queueDownsampleInvalidate();

      // chart indicated we got a scales update, we may need to update global bounds
      if (!isSynced || !scales?.x) {
        return;
      }

      // the change is a result of user interaction on our chart
      // we set the sync scale value so other synced charts follow our zoom/pan behavior
      if (userInteraction && isSynced) {
        setGlobalBounds({
          min: scales.x.min,
          max: scales.x.max,
          sourceId: componentId,
          userInteraction: true,
        });
        return;
      }

      // the scales changed due to new data or another non-user initiated event
      // the sync value is conditionally set depending on the state of the existing sync value
      setGlobalBounds((old) => {
        // no scale from our plot, always use old value
        const scalesX = scales?.x;
        if (!scalesX) {
          return old;
        }

        // no old value for sync, initialize with our value
        if (!old) {
          return {
            min: scalesX.min,
            max: scalesX.max,
            sourceId: componentId,
            userInteraction: false,
          };
        }

        // give preference to an old value set via user interaction
        // note that updates due to _our_ user interaction are set earlier
        if (old.userInteraction) {
          return old;
        }

        // calculate min/max based on old value and our new scale
        const newMin = Math.min(scalesX.min, old.min);
        const newMax = Math.max(scalesX.max, old.max);

        // avoid making a new sync object if the existing one matches our range
        // avoids infinite set states
        if (old.max === newMax && old.min === newMin) {
          return old;
        }

        // existing value does not match our new range, update the global sync value
        return {
          min: newMin,
          max: newMax,
          sourceId: componentId,
          userInteraction: false,
        };
      });
    },
    [componentId, isMounted, isSynced, queueDownsampleInvalidate, setGlobalBounds],
  );

  useEffect(() => log.debug(`<TimeBasedChart> (datasetId=${datasetId})`), [datasetId]);

  const tooltipContent = useMemo(() => {
    return activeTooltip ? (
      <TimeBasedChartTooltipContent tooltip={activeTooltip.data} />
    ) : undefined;
  }, [activeTooltip]);

  // reset is shown if we have sync lock and there has been user interaction, or if we don't
  // have sync lock and the user has manually interacted with the plot
  //
  // The reason we check for pan lock is to remove reset display from all sync'd plots once
  // the range has been reset.
  const showReset = useMemo(() => {
    return isSynced ? globalBounds?.userInteraction === true : hasUserPannedOrZoomed;
  }, [globalBounds?.userInteraction, hasUserPannedOrZoomed, isSynced]);

  // We don't memo this since each option itself is memo'd and this is just convenience to pass to
  // the component.
  const chartProps: ChartComponentProps = {
    type,
    width,
    height,
    options,
    data: downsampledData,
    onClick: props.onClick,
    onScalesUpdate,
    onChartUpdate,
    onHover,
  };

  // avoid rendering if width/height are 0 - usually on initial mount
  // so we don't trigger onChartUpdate if we know we will immediately resize
  if (width === 0 || height === 0) {
    return <></>;
  }

  return (
    <div style={{ display: "flex", width: "100%" }}>
      <Tooltip
        shown
        noPointerEvents={true}
        targetPosition={{ x: activeTooltip?.x ?? 0, y: activeTooltip?.y ?? 0 }}
        contents={tooltipContent}
      />
      <div style={{ display: "flex", width }}>
        <SRoot onDoubleClick={onResetZoom}>
          <HoverBar
            componentId={componentId}
            isTimestampScale={xAxisIsPlaybackTime}
            scales={currentScalesRef.current}
          >
            <SBar xAxisIsPlaybackTime={xAxisIsPlaybackTime} ref={hoverBar} />
          </HoverBar>

          <div ref={canvasContainer} onMouseMove={onMouseMove} onMouseOut={onMouseOut}>
            <ChartComponent {...chartProps} />
          </div>

          <SResetZoom>
            {showReset && (
              <Button tooltip="(shortcut: double-click)" onClick={onResetZoom}>
                reset view
              </Button>
            )}
          </SResetZoom>
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
}
