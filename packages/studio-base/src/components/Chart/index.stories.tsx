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
import { StoryObj } from "@storybook/react";
import * as _ from "lodash-es";
import { useState, useCallback, ComponentProps, useEffect } from "react";
import TestUtils from "react-dom/test-utils";

import { useReadySignal } from "@foxglove/studio-base/stories/ReadySignalContext";

import ChartComponent, { OnClickArg } from ".";

const dataPoint = {
  x: 0.000057603000000000004,
  y: 5.544444561004639,
  selectionObj: 1,
  label: "datalabel with selection id 1",
  value: 5.544444561004639,
};

const props: ComponentProps<typeof ChartComponent> = {
  width: 500,
  height: 700,
  isBoundsReset: false,
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
        data: [dataPoint],
        datalabels: { display: false },
      },
    ],
  },
  options: {
    animation: { duration: 0 },
    elements: { line: { tension: 0 } },
    plugins: {
      legend: { display: false },
      annotation: { annotations: [] },
      datalabels: {
        anchor: "start",
        align: 0,
        offset: 5,
        color: "white",
      },
      zoom: {
        zoom: {
          enabled: true,
          mode: "xy",
          sensitivity: 3,
          speed: 0.1,
        },
        pan: {
          enabled: true,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          font: {
            family: `"IBM Plex Mono"`,
            size: 10,
          },
          color: "#eee",
          padding: 0,
          precision: 3,
        },
        grid: {
          color: "rgba(255, 255, 255, 0.2)",
        },
      },

      x: {
        ticks: {
          font: {
            family: `"IBM Plex Mono"`,
            size: 10,
          },
          color: "#eee",
          maxRotation: 0,
        },
        grid: {
          color: "rgba(255, 255, 255, 0.2)",
        },
      },
    },
  },
  type: "scatter",
};

const propsWithDatalabels = _.cloneDeep(props);
if (propsWithDatalabels.data!.datasets[0]?.datalabels) {
  propsWithDatalabels.data!.datasets[0].datalabels.display = true;
}

const divStyle = { width: 600, height: 800, background: "black" };

export default {
  title: "components/Chart",
  component: ChartComponent,
  parameters: {
    chromatic: {
      // additional delay for any final clicks or renders
      delay: 100,
    },
    colorScheme: "dark",
    disableI18n: true,
  },
};

export const Basic: StoryObj = {
  render: function Story() {
    const readySignal = useReadySignal();

    return (
      <div style={divStyle}>
        <ChartComponent {...props} onFinishRender={readySignal} />
      </div>
    );
  },

  play: async (ctx) => {
    await ctx.parameters.storyReady;
  },

  parameters: {
    useReadySignal: true,
  },
};

export const WithDatalabels: StoryObj = {
  render: function Story() {
    const readySignal = useReadySignal();

    return (
      <div style={divStyle}>
        <ChartComponent {...propsWithDatalabels} onFinishRender={readySignal} />
      </div>
    );
  },

  play: async (ctx) => {
    await ctx.parameters.storyReady;
  },

  parameters: {
    useReadySignal: true,
  },
};

export const AllowsClickingOnDatalabels: StoryObj = {
  render: function Story() {
    const [clickedDatalabel, setClickedDatalabel] = useState<unknown>(undefined);
    const readySignal = useReadySignal();

    const doClick = useCallback(() => {
      if (clickedDatalabel == undefined) {
        const [canvas] = document.getElementsByTagName("canvas");
        TestUtils.Simulate.click(canvas!.parentElement!, { clientX: 304, clientY: 378 });
      }
    }, [clickedDatalabel]);

    const onClick = useCallback((ev: OnClickArg) => {
      setClickedDatalabel(ev.datalabel);
    }, []);

    useEffect(() => {
      if (clickedDatalabel != undefined) {
        readySignal();
      }
    }, [clickedDatalabel, readySignal]);

    return (
      <div style={divStyle}>
        <div style={{ padding: 6, fontSize: 16 }}>
          {clickedDatalabel != undefined
            ? `Clicked datalabel with selection id: ${String(
                (clickedDatalabel as Record<string, unknown>).selectionObj,
              )}`
            : "Have not clicked datalabel"}
        </div>
        <ChartComponent {...propsWithDatalabels} onFinishRender={doClick} onClick={onClick} />
      </div>
    );
  },

  play: async (ctx) => {
    await ctx.parameters.storyReady;
  },

  parameters: {
    useReadySignal: true,
  },
};
