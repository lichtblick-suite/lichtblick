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
import cloneDeep from "lodash/cloneDeep";
import { useState, useCallback, useRef } from "react";

import MockMessagePipelineProvider from "@foxglove-studio/app/components/MessagePipeline/MockMessagePipelineProvider";
import signal from "@foxglove-studio/app/shared/signal";
import { triggerWheel } from "@foxglove-studio/app/stories/PanelSetup";

import TimeBasedChart, { TimeBasedChartTooltipData } from "./index";
import type { Props } from "./index";

const dataX = 0.000057603000000000004;
const dataY = 5.544444561004639;
const tooltipData: TimeBasedChartTooltipData = {
  x: dataX,
  y: dataY,
  item: {
    headerStamp: undefined,
    receiveTime: { sec: 1396293889, nsec: 214366 },
    queriedData: [{ constantName: "", value: 5.544444561004639, path: "/turtle1/pose.x" }],
  },
  path: "/turtle1/pose.x",
  datasetKey: "0",
  value: 5.544444561004639,
  startTime: { sec: 1396293889, nsec: 156763 },
};

const commonProps: Props = {
  isSynced: true,
  zoom: true,
  width: 800,
  height: 600,
  data: {
    datasets: [
      {
        borderColor: "#4e98e2",
        label: "/turtle1/pose.x",
        showLine: true,
        borderWidth: 1,
        pointRadius: 1.5,
        pointHoverRadius: 3,
        pointBackgroundColor: "#74beff",
        pointBorderColor: "transparent",
        data: [
          {
            x: dataX,
            y: dataY,
          },
        ],
      },
      {
        borderColor: "#f5774d",
        label: "a42771fb-b547-4c61-bbaa-9059dec68e49",
        showLine: true,
        borderWidth: 1,
        pointRadius: 1.5,
        pointHoverRadius: 3,
        pointBackgroundColor: "#ff9d73",
        pointBorderColor: "transparent",
        data: [],
      },
    ],
  },
  tooltips: [tooltipData],
  annotations: [],
  type: "scatter",
  xAxes: {
    ticks: { precision: 3 },
    grid: { color: "rgba(255, 255, 255, 0.2)" },
  },
  yAxes: {
    ticks: { precision: 3 },
    grid: { color: "rgba(255, 255, 255, 0.2)" },
  },
  xAxisIsPlaybackTime: true,
};

export default {
  title: "<TimeBasedChart>",
  component: TimeBasedChart,
  parameters: {
    screenshot: {
      delay: 1500,
    },
  },
};

const simpleSignal = signal();
export const Simple = () => {
  const pauseFrame = useCallback(() => {
    return () => {
      simpleSignal.resolve();
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", background: "black" }}>
      <MockMessagePipelineProvider pauseFrame={pauseFrame}>
        <TimeBasedChart {...commonProps} />
      </MockMessagePipelineProvider>
    </div>
  );
};

Simple.parameters = {
  screenshot: {
    waitFor: simpleSignal,
  },
};

// zoom and update without resetting zoom
const zoomAndUpdateSignal = signal();
export const CanZoomAndUpdate = () => {
  const okTrigger = useRef(false);
  const pauseFrame = useCallback(() => {
    return () => {
      if (okTrigger.current) {
        zoomAndUpdateSignal.resolve();
      }
    };
  }, []);

  const [chartProps, setChartProps] = useState(cloneDeep(commonProps));

  const refFn = useCallback(() => {
    setTimeout(() => {
      const canvasEl = document.querySelector("canvas");
      // Zoom is a continuous event, so we need to simulate wheel multiple times
      if (canvasEl) {
        for (let i = 0; i < 5; i++) {
          triggerWheel(canvasEl, 1);
        }
        setTimeout(() => {
          setChartProps((oldProps) => {
            // the next chart render will trigger our screenshot signal
            okTrigger.current = true;

            const newProps = cloneDeep(oldProps);
            const newDataPoint = cloneDeep(newProps.data.datasets[0]!.data[0]!);
            newDataPoint.x = 20;
            newProps.data.datasets[0]!.data[1] = newDataPoint;
            return newProps;
          });
        }, 50);
      }
    }, 200);
  }, []);

  return (
    <div style={{ width: 800, height: 800, background: "black" }} ref={refFn}>
      <MockMessagePipelineProvider pauseFrame={pauseFrame}>
        <TimeBasedChart {...chartProps} width={800} height={800} />
      </MockMessagePipelineProvider>
    </div>
  );
};
CanZoomAndUpdate.parameters = { screenshot: { waitFor: zoomAndUpdateSignal } };

export const CleansUpTooltipOnUnmount = () => {
  const [hasRenderedOnce, setHasRenderedOnce] = useState<boolean>(false);
  const refFn = useCallback(() => {
    setTimeout(() => {
      const [canvas] = document.getElementsByTagName("canvas");
      const { top, left } = canvas!.getBoundingClientRect();
      document.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 363 + left, clientY: 650 + top }),
      );
      setTimeout(() => {
        setHasRenderedOnce(true);
      }, 100);
    }, 200);
  }, []);
  return (
    <div style={{ width: "100%", height: "100%", background: "black" }} ref={refFn}>
      <MockMessagePipelineProvider>
        {!hasRenderedOnce && <TimeBasedChart {...commonProps} />}
      </MockMessagePipelineProvider>
    </div>
  );
};

export const CallPauseOnInitialMount = () => {
  const [unpauseFrameCount, setUnpauseFrameCount] = useState(0);
  const pauseFrame = useCallback(() => {
    return () => {
      setUnpauseFrameCount((old) => old + 1);
    };
  }, [setUnpauseFrameCount]);

  return (
    <div style={{ width: "100%", height: "100%", background: "black" }}>
      <div style={{ fontSize: 20, padding: 6 }}>
        Finished pause frame count: {unpauseFrameCount}
      </div>
      <MockMessagePipelineProvider pauseFrame={pauseFrame}>
        <TimeBasedChart {...commonProps} />
      </MockMessagePipelineProvider>
    </div>
  );
};

// We should still call resumeFrame exactly once when removed in the middle of an update.
// The way this test works:
// - start by rendering the chart normally
// - after the timeout (chart should be rendered), force a re-render of the chart.
// - This rerender updates the chart, which calls `pauseFrame` until the chart has finished updating
// - in `pauseFrame`, trigger an update that removes the chart. This happens before the returned function
// (`resumeFrame`) fires.
// - `resumeFrame` should then fire exactly once.
// shows `SUCCESS` message with no chart visible
export const ResumeFrameOnUnmount = () => {
  const [showChart, setShowChart] = useState(true);
  const [statusMessage, setStatusMessage] = useState("FAILURE - START");
  const pauseFrame = useCallback(() => {
    setShowChart(() => false);
    return () => {
      setStatusMessage((old) => {
        if (old === "FAILURE - START") {
          return "SUCCESS";
        } else {
          return "FAILURE - CANNOT CALL RESUME FRAME TWICE";
        }
      });
    };
  }, [setStatusMessage]);

  return (
    <div style={{ width: "100%", height: "100%", background: "black" }}>
      <MockMessagePipelineProvider pauseFrame={pauseFrame}>
        <div style={{ fontSize: 48, padding: 50 }}>{statusMessage}</div>
        {showChart && <TimeBasedChart {...commonProps} />}
      </MockMessagePipelineProvider>
    </div>
  );
};
