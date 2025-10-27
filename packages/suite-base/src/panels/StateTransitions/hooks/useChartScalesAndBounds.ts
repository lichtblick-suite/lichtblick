// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ScaleOptions } from "chart.js";
import { RefCallback, useEffect, useMemo } from "react";
import { useResizeDetector } from "react-resize-detector";

import { StateTransitionConfig } from "@lichtblick/suite-base/panels/StateTransitions/types";
import { Bounds } from "@lichtblick/suite-base/types/Bounds";

type UseChartScalesAndBounds = {
  yScale: ScaleOptions<"linear">;
  xScale: ScaleOptions<"linear">;
  databounds: Bounds | undefined;
  width: number | undefined;
  sizeRef: RefCallback<HTMLDivElement>;
};

const useChartScalesAndBounds = (
  minY: number | undefined,
  currentTimeSinceStart: number | undefined,
  endTimeSinceStart: number | undefined,
  config: StateTransitionConfig,
): UseChartScalesAndBounds => {
  const yScale = useMemo<ScaleOptions<"linear">>(() => {
    return {
      ticks: {
        // Hide all y-axis ticks since each bar on the y-axis is just a separate path.
        display: false,
      },
      grid: {
        display: false,
      },
      type: "linear",
      min: minY,
      max: -3,
    };
  }, [minY]);

  const xScale = useMemo<ScaleOptions<"linear">>(() => {
    return {
      type: "linear",
      border: {
        display: false,
      },
    };
  }, []);

  // Compute the fixed bounds (either via min/max x-axis config or end time since start).
  //
  // For recordings, the bounds are actually fixed but for live connections the "endTimeSinceStart"
  // will increase and these bounds are not technically fixed. But in those instances there is also
  // new data coming in when the bounds are changing.
  //
  // We need to keep the fixedBounds reference stable (if it can be stable) for the databounds memo
  // below, otherwise playing through a recording will update the currentTimeSince start and return
  // a new fixedBounds reference which causes expensive downstream rendering.
  const fixedBounds = useMemo(() => {
    if (endTimeSinceStart == undefined) {
      return undefined;
    }

    if (config.xAxisMinValue != undefined || config.xAxisMaxValue != undefined) {
      return {
        x: {
          min: config.xAxisMinValue ?? 0,
          max: config.xAxisMaxValue ?? endTimeSinceStart,
        },
        y: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
      };
    }

    // If we have no configured xAxis min/max or range, then we set the x axis max to end time
    // This will mirror the plot behavior of showing the full x-axis for data time range rather
    // than constantly adjusting the end time to the latest loaded state transition while data
    // is loading.
    return {
      x: { min: 0, max: endTimeSinceStart },
      y: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
    };
  }, [config.xAxisMaxValue, config.xAxisMinValue, endTimeSinceStart]);

  // Compute the data bounds. The bounds are either a fixed amount of lookback from the current time
  // or they are fixed bounds with a specific range.
  const databounds: undefined | Bounds = useMemo(() => {
    if (config.xAxisRange != undefined && currentTimeSinceStart != undefined) {
      return {
        x: { min: currentTimeSinceStart - config.xAxisRange, max: currentTimeSinceStart },
        y: { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
      };
    }

    return fixedBounds;
  }, [config.xAxisRange, currentTimeSinceStart, fixedBounds]);

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // an existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const { width, ref: sizeRef } = useResizeDetector<HTMLDivElement>({
    handleHeight: false,
    refreshRate: 0,
    refreshMode: "debounce",
  });

  // Disable the wheel event for the chart wrapper div (which is where we use sizeRef)
  //
  // The chart component uses wheel events for zoom and pan. After adding more series, the logic
  // expands the chart element beyond the visible area of the panel. When this happens, scrolling on
  // the chart also scrolls the chart wrapper div and results in zooming that chart AND scrolling
  // the panel. This behavior is undesirable.
  //
  // This effect registers a wheel event handler for the wrapper div to prevent scrolling. To scroll
  // the panel the user will use the scrollbar.
  useEffect(() => {
    const el = sizeRef.current;
    const handler = (ev: WheelEvent) => {
      ev.preventDefault();
    };

    el?.addEventListener("wheel", handler);
    return () => {
      el?.removeEventListener("wheel", handler);
    };
  }, [sizeRef]);

  return { yScale, xScale, databounds, width, sizeRef };
};

export default useChartScalesAndBounds;
