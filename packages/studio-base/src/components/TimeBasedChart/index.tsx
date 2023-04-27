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

import { Button, Fade, Tooltip, useTheme } from "@mui/material";
import { ChartOptions, ScaleOptions } from "chart.js";
import { AnnotationOptions } from "chartjs-plugin-annotation";
import { isEqual } from "lodash";
import React, {
  ComponentProps,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMountedState, useThrottle } from "react-use";
import { makeStyles } from "tss-react/mui";
import { useDebouncedCallback } from "use-debounce";
import { v4 as uuidv4 } from "uuid";

import type { ZoomOptions } from "@foxglove/chartjs-plugin-zoom/types/options";
import { filterMap } from "@foxglove/den/collection";
import Logger from "@foxglove/log";
import ChartComponent from "@foxglove/studio-base/components/Chart/index";
import { RpcElement, RpcScales } from "@foxglove/studio-base/components/Chart/types";
import KeyListener from "@foxglove/studio-base/components/KeyListener";
import { useMessagePipeline } from "@foxglove/studio-base/components/MessagePipeline";
import Stack from "@foxglove/studio-base/components/Stack";
import {
  TimelineInteractionStateStore,
  useClearHoverValue,
  useSetHoverValue,
  useTimelineInteractionState,
} from "@foxglove/studio-base/context/TimelineInteractionStateContext";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import HoverBar from "./HoverBar";
import TimeBasedChartTooltipContent, {
  TimeBasedChartTooltipData,
} from "./TimeBasedChartTooltipContent";
import { VerticalBarWrapper } from "./VerticalBarWrapper";
import { downsampleScatter, downsampleTimeseries } from "./downsample";

const log = Logger.getLogger(__filename);

const useStyles = makeStyles()((theme) => ({
  root: {
    position: "relative",
  },
  resetZoomButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    marginBottom: theme.spacing(4),
    marginRight: theme.spacing(1),
  },
  tooltip: {
    maxWidth: "none",
  },
  bar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    marginLeft: -1,
    display: "block",
  },
  playbackBar: {
    backgroundColor: "#aaa",
  },
}));

type ChartComponentProps = ComponentProps<typeof ChartComponent>;

const selectGlobalBounds = (store: TimelineInteractionStateStore) => store.globalBounds;
const selectSetGlobalBounds = (store: TimelineInteractionStateStore) => store.setGlobalBounds;

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
  tooltips?: Map<string, TimeBasedChartTooltipData>;
  xAxes?: ScaleOptions<"linear">;
  yAxes: ScaleOptions<"linear">;
  annotations?: AnnotationOptions[];
  isSynced?: boolean;
  linesToHide?: {
    [key: string]: boolean;
  };
  datasetId?: string;
  onClick?: ChartComponentProps["onClick"];
  // If the x axis represents playback time ("timestamp"), the hover cursor will be synced.
  // Note, this setting should not be used for other time values.
  xAxisIsPlaybackTime: boolean;
  showXAxisLabels: boolean;
  plugins?: ChartOptions["plugins"];
  currentTime?: number;
  defaultView?: ChartDefaultView;
};

// Create a chart with any y-axis but with an x-axis that shows time since the
// start of the bag, and which is kept in sync with other instances of this
// component. Uses chart.js internally, with a zoom/pan plugin, and with our
// standard tooltips.
export default function TimeBasedChart(props: Props): JSX.Element {
  const requestID = useRef<number>(0);
  const {
    datasetId,
    type,
    width,
    height,
    data,
    isSynced = false,
    yAxes,
    xAxes,
    defaultView,
    currentTime,
    xAxisIsPlaybackTime,
    showXAxisLabels,
  } = props;

  const { labels, datasets } = data;

  const theme = useTheme();
  const { classes, cx } = useStyles();
  const componentId = useMemo(() => uuidv4(), []);
  const isMounted = useMountedState();
  const canvasContainer = useRef<HTMLDivElement>(ReactNull);

  const [hasUserPannedOrZoomed, setHasUserPannedOrZoomed] = useState<boolean>(false);

  const pauseFrame = useMessagePipeline(
    useCallback((messagePipeline) => messagePipeline.pauseFrame, []),
  );

  const resumeFrame = useRef<() => void | undefined>();
  const requestedResumeFrame = useRef<() => void | undefined>();

  // when data changes, we pause and wait for onFinishRender to resume
  const onStartRender = useCallback(() => {
    if (resumeFrame.current) {
      resumeFrame.current();
    }
    // during streaming the message pipeline should not give us any more data until we finish
    // rendering this update
    resumeFrame.current = pauseFrame("TimeBasedChart");
  }, [pauseFrame]);

  // resumes any paused frames
  // since we render in a web-worker we need to pause/resume the message pipeline to keep
  // our plot rendeirng in-sync with data rendered elsewhere in the app
  const onFinishRender = useCallback(() => {
    const current = resumeFrame.current;
    resumeFrame.current = undefined;
    requestedResumeFrame.current = current;

    if (current) {
      // allow the chart offscreen canvas to render to screen before calling done
      requestID.current = requestAnimationFrame(() => {
        current();
        requestedResumeFrame.current = undefined;
      });
    }
  }, []);

  useEffect(() => {
    // cleanup paused frames on unmount or dataset changes
    return () => {
      onFinishRender();
      cancelAnimationFrame(requestID.current);
      requestedResumeFrame.current?.();
    };
  }, [pauseFrame, onFinishRender]);

  const globalBounds = useTimelineInteractionState(selectGlobalBounds);
  const setGlobalBounds = useTimelineInteractionState(selectSetGlobalBounds);

  // Ignore global bounds if we're not synced.
  const syncedGlobalBounds = useMemo(
    () => (isSynced ? globalBounds : undefined),
    [globalBounds, isSynced],
  );

  const linesToHide = useMemo(() => props.linesToHide ?? {}, [props.linesToHide]);

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

  const mouseYRef = useRef<number | undefined>(undefined);

  // We use a custom tooltip so we can style it more nicely, and so that it can break
  // out of the bounds of the canvas, in case the panel is small.
  const [activeTooltip, setActiveTooltip] = useState<{
    x: number;
    y: number;
    data: TimeBasedChartTooltipData[];
  }>();

  const updateTooltip = useCallback((elements: RpcElement[]) => {
    if (elements.length === 0 || mouseYRef.current == undefined) {
      return setActiveTooltip(undefined);
    }

    const tooltipItems: { item: TimeBasedChartTooltipData; element: RpcElement }[] = [];

    for (const element of elements) {
      if (!element.data) {
        continue;
      }

      const datum = element.data;
      if (datum.value == undefined) {
        continue;
      }

      tooltipItems.push({
        item: {
          datasetIndex: element.datasetIndex,
          value: datum.value,
          constantName: datum.constantName,
        },
        element,
      });
    }

    if (tooltipItems.length === 0) {
      return setActiveTooltip(undefined);
    }

    const element = tooltipItems[0]!.element;

    const canvasRect = canvasContainer.current?.getBoundingClientRect();
    if (canvasRect) {
      setActiveTooltip({
        x: canvasRect.left + element.view.x,
        y: canvasRect.top + mouseYRef.current,
        data: tooltipItems.map((item) => item.item),
      });
    }
  }, []);

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

      // tooltip vertical placement align with the cursor y value
      mouseYRef.current = event.pageY - canvasContainerRect.top;

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
      annotation: { annotations: props.annotations },
    };
  }, [props.annotations, props.plugins, props.zoom, zoomMode]);

  // To avoid making a new xScale identity on all updates that might change the min/max
  // we memo the min/max X values so only when the values change is the scales object re-made
  const { min: minX, max: maxX } = useMemo(() => {
    // when unlocking sync keep the last manually panned/zoomed chart state
    if (!syncedGlobalBounds && hasUserPannedOrZoomed) {
      return { min: undefined, max: undefined };
    }

    // If we're the source of global bounds then use our current values
    // to avoid scale feedback jitter.
    if (syncedGlobalBounds?.sourceId === componentId && syncedGlobalBounds.userInteraction) {
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

    // If the global bounds are from user interaction, we use that unconditionally.
    if (syncedGlobalBounds?.userInteraction === true) {
      min = syncedGlobalBounds.min;
      max = syncedGlobalBounds.max;
    }

    // if the min/max are the same, use undefined to fall-back to chart component auto-scales
    // without this the chart axis does not appear since it has as 0 size
    if (min === max) {
      return { min: undefined, max: undefined };
    }

    return { min, max };
  }, [
    componentId,
    currentTime,
    datasetBounds.x.max,
    datasetBounds.x.min,
    defaultView,
    syncedGlobalBounds,
    hasUserPannedOrZoomed,
  ]);

  const xScale = useMemo<ScaleOptions>(() => {
    const defaultXTicksSettings: ScaleOptions["ticks"] = {
      font: {
        family: fonts.MONOSPACE,
        size: 10,
      },
      color: theme.palette.text.secondary,
      maxRotation: 0,
    };

    const scale: ScaleOptions<"linear"> = {
      grid: { color: theme.palette.divider },
      ...xAxes,
      min: minX,
      max: maxX,
      ticks: {
        display: showXAxisLabels,
        ...defaultXTicksSettings,
        ...xAxes?.ticks,
      },
    };

    return scale;
  }, [theme.palette, showXAxisLabels, xAxes, minX, maxX]);

  const yScale = useMemo<ScaleOptions>(() => {
    const defaultYTicksSettings: ScaleOptions["ticks"] = {
      font: {
        family: fonts.MONOSPACE,
        size: 10,
      },
      color: theme.palette.text.secondary,
      padding: 0,
    };

    let { min: minY, max: maxY } = yAxes;

    // chartjs doesn't like it when only one of min/max are specified for scales
    // so if either is specified then we specify both
    if (maxY == undefined && minY != undefined) {
      maxY = datasetBounds.y.max;
    }
    if (minY == undefined && maxY != undefined) {
      minY = datasetBounds.y.min;
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
  }, [datasetBounds.y, yAxes, theme.palette]);

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
      if (currentScales?.x && currentScales.y) {
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
        // NaN item values create gaps in the line
        const undefinedToNanData = downsampled.data.map((item) => {
          if (item == undefined || isNaN(item.x) || isNaN(item.y)) {
            return { x: NaN, y: NaN, value: NaN };
          }
          return item;
        });

        return { ...downsampled, data: undefinedToNanData };
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
  // avoids doing a downsample if the callback changes rapidly
  const throttledDownsample = useThrottle(() => downsampleDatasets, 100);

  // downsample datasets with the latest downsample function
  const downsampledDatasets = useMemo(() => {
    void invalidateDownsample;

    return throttledDownsample(visibleDatasets);
  }, [invalidateDownsample, throttledDownsample, visibleDatasets]);

  const downsampledData = useMemo(() => {
    return {
      labels,
      datasets: downsampledDatasets,
    };
  }, [labels, downsampledDatasets]);

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
        updateTooltip(elements);
      }
    },
    [isMounted, updateTooltip],
  );

  const onScalesUpdate = useCallback(
    (scales: RpcScales, { userInteraction }: { userInteraction: boolean }) => {
      if (!isMounted()) {
        return;
      }

      // If this is an update from the chart adjusting its own bounds and not a
      // user interaction and the X scale is defined but hasn't changed we can
      // skip updating global bounds and downsampling. This avoids a feedback
      // loop on boundary conditions when the chart is adjusting its own Y axis
      // to fit the dataset.
      if (
        scales.x != undefined &&
        isEqual(scales.x, currentScalesRef.current?.x) &&
        !userInteraction
      ) {
        return;
      }

      if (userInteraction) {
        setHasUserPannedOrZoomed(true);
      }

      currentScalesRef.current = scales;

      queueDownsampleInvalidate();

      // chart indicated we got a scales update, we may need to update global bounds
      if (!isSynced || !scales.x) {
        return;
      }

      // the change is a result of user interaction on our chart
      // we set the sync scale value so other synced charts follow our zoom/pan behavior
      if (userInteraction) {
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
        const scalesX = scales.x;
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

  const colorsByDatasetIndex = useMemo(() => {
    return Object.fromEntries(
      data.datasets.map((dataset, index) => [index, dataset.borderColor?.toString()]),
    );
  }, [data.datasets]);

  const labelsByDatasetIndex = useMemo(() => {
    return Object.fromEntries(data.datasets.map((dataset, index) => [index, dataset.label]));
  }, [data.datasets]);

  const datasetsLength = datasets.length;
  const tooltipContent = useMemo(() => {
    return activeTooltip ? (
      <TimeBasedChartTooltipContent
        content={activeTooltip.data}
        multiDataset={datasetsLength > 1}
        colorsByDatasetIndex={colorsByDatasetIndex}
        labelsByDatasetIndex={labelsByDatasetIndex}
      />
    ) : undefined;
  }, [activeTooltip, colorsByDatasetIndex, datasetsLength, labelsByDatasetIndex]);

  // reset is shown if we have sync lock and there has been user interaction, or if we don't
  // have sync lock and the user has manually interacted with the plot
  //
  // The reason we check for pan lock is to remove reset display from all sync'd plots once
  // the range has been reset.
  const showReset = useMemo(() => {
    return isSynced ? syncedGlobalBounds?.userInteraction === true : hasUserPannedOrZoomed;
  }, [syncedGlobalBounds?.userInteraction, hasUserPannedOrZoomed, isSynced]);

  // We don't memo this since each option itself is memo'd and this is just convenience to pass to
  // the component.
  const chartProps: ChartComponentProps = {
    type,
    width,
    height,
    isBoundsReset: globalBounds == undefined,
    options,
    data: downsampledData,
    onClick: props.onClick,
    onScalesUpdate,
    onStartRender,
    onFinishRender,
    onHover,
  };

  // avoid rendering if width/height are 0 - usually on initial mount
  // so we don't trigger onFinishRender if we know we will immediately resize
  if (width === 0 || height === 0) {
    return <></>;
  }

  return (
    <Stack direction="row" fullWidth>
      <Tooltip
        arrow={false}
        classes={{ tooltip: classes.tooltip }}
        open={activeTooltip != undefined}
        placement="right"
        title={tooltipContent ?? <></>}
        disableInteractive
        followCursor
        TransitionComponent={Fade}
        TransitionProps={{ timeout: 0 }}
      >
        <Stack direction="row" style={{ width }}>
          <div className={classes.root} onDoubleClick={onResetZoom}>
            <HoverBar
              componentId={componentId}
              isTimestampScale={xAxisIsPlaybackTime}
              scales={currentScalesRef.current}
            >
              <div
                className={classes.bar}
                style={{
                  backgroundColor: xAxisIsPlaybackTime
                    ? theme.palette.warning.main
                    : theme.palette.info.main,
                }}
              />
            </HoverBar>
            {xAxisIsPlaybackTime && (
              <VerticalBarWrapper scales={currentScalesRef.current} xValue={currentTime}>
                <div className={cx(classes.bar, classes.playbackBar)} />
              </VerticalBarWrapper>
            )}

            <div ref={canvasContainer} onMouseMove={onMouseMove} onMouseOut={onMouseOut}>
              <ChartComponent {...chartProps} />
            </div>

            {showReset && (
              <Button
                className={classes.resetZoomButton}
                variant="contained"
                color="inherit"
                title="(shortcut: double-click)"
                onClick={onResetZoom}
              >
                Reset view
              </Button>
            )}
            <KeyListener global keyDownHandlers={keyDownHandlers} keyUpHandlers={keyUphandlers} />
          </div>
        </Stack>
      </Tooltip>
    </Stack>
  );
}
