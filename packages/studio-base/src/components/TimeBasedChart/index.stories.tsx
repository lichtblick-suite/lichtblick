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
import { useState, useCallback, useRef, useEffect } from "react";
import TestUtils from "react-dom/test-utils";
import { useAsync } from "react-use";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { triggerWheel } from "@foxglove/studio-base/stories/PanelSetup";
import { useReadySignal } from "@foxglove/studio-base/stories/ReadySignalContext";

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
    grid: { color: "rgba(187, 187, 187, 0.2)" },
  },
  yAxes: {
    ticks: { precision: 3 },
    grid: { color: "rgba(187, 187, 187, 0.2)" },
  },
  xAxisIsPlaybackTime: true,
};

export default {
  title: "components/TimeBasedChart",
  component: TimeBasedChart,
  parameters: {
    chromatic: {
      delay: 50,
    },
    colorScheme: "dark",
  },
};

export function Simple(): JSX.Element {
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <MockMessagePipelineProvider>
        <TimeBasedChart {...commonProps} />
      </MockMessagePipelineProvider>
    </div>
  );
}
export const SimpleLight = Object.assign(Simple.bind(undefined), {
  parameters: { colorScheme: "light" },
});

// zoom and update without resetting zoom
export function CanZoomAndUpdate(): JSX.Element {
  const [chartProps, setChartProps] = useState(cloneDeep(commonProps));
  const callCountRef = useRef(0);

  const doScroll = useCallback(async () => {
    const canvasEl = document.querySelector("canvas");
    if (!canvasEl) {
      return;
    }

    // Zoom is a continuous event, so we need to simulate wheel multiple times
    for (let i = 0; i < 5; i++) {
      triggerWheel(canvasEl, 2);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    setChartProps((oldProps) => {
      const newProps = cloneDeep(oldProps);
      const newDataPoint = cloneDeep(newProps.data.datasets[0]!.data[0]!);
      newDataPoint.x = 20;
      newProps.data.datasets[0]!.data[1] = newDataPoint;
      return newProps;
    });
  }, []);

  const pauseFrame = useCallback(() => {
    return () => {
      // first render of the chart triggers scrolling
      if (callCountRef.current === 0) {
        void doScroll();
      }

      ++callCountRef.current;
    };
  }, [doScroll]);

  return (
    <div style={{ width: 800, height: 800, background: "black" }}>
      <MockMessagePipelineProvider pauseFrame={pauseFrame}>
        <TimeBasedChart {...chartProps} width={800} height={800} />
      </MockMessagePipelineProvider>
    </div>
  );
}

CanZoomAndUpdate.parameters = {
  chromatic: {
    delay: 500,
  },
};

CleansUpTooltipOnUnmount.parameters = { useReadySignal: true };
export function CleansUpTooltipOnUnmount(_args: unknown): JSX.Element | ReactNull {
  const [hasRenderedOnce, setHasRenderedOnce] = useState<boolean>(false);
  const { error } = useAsync(async () => {
    const [canvas] = document.getElementsByTagName("canvas");
    const { top, left } = canvas!.getBoundingClientRect();
    // wait for chart to render before triggering tooltip
    let tooltip: Element | undefined;

    TestUtils.Simulate.mouseEnter(canvas!);
    for (let i = 0; !tooltip && i < 20; i++) {
      TestUtils.Simulate.mouseMove(canvas!, { clientX: 333 + left, clientY: 650 + top });
      await new Promise((resolve) => setTimeout(resolve, 100));
      tooltip = document.querySelector("[data-test~=TimeBasedChartTooltipContent]") ?? undefined;
    }
    if (tooltip == undefined) {
      throw new Error("could not find tooltip");
    }
    setHasRenderedOnce(true);
  }, []);

  const readySignal = useReadySignal();

  useEffect(() => {
    if (hasRenderedOnce) {
      readySignal();
    }
  }, [hasRenderedOnce, readySignal]);

  if (error) {
    throw error;
  }

  if (hasRenderedOnce) {
    return <></>;
  }

  return (
    <div style={{ width: "100%", height: "100%", background: "black" }}>
      <MockMessagePipelineProvider>
        <TimeBasedChart {...commonProps} />
      </MockMessagePipelineProvider>
    </div>
  );
}

export function CallPauseOnInitialMount(): JSX.Element {
  const [unpauseFrameCount, setUnpauseFrameCount] = useState(0);
  const pauseFrame = useCallback(() => {
    return () => {
      setUnpauseFrameCount((old) => old + 1);
    };
  }, []);

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
}

// We should still call resumeFrame exactly once when removed in the middle of an update.
// The way this test works:
// - start by rendering the chart normally
// - after the timeout (chart should be rendered), force a re-render of the chart.
// - This rerender updates the chart, which calls `pauseFrame` until the chart has finished updating
// - in `pauseFrame`, trigger an update that removes the chart. This happens before the returned function
// (`resumeFrame`) fires.
// - `resumeFrame` should then fire exactly once.
// shows `SUCCESS` message with no chart visible
export function ResumeFrameOnUnmount(): JSX.Element {
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
}
