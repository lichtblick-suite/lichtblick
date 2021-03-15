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
import { storiesOf } from "@storybook/react";
import cloneDeep from "lodash/cloneDeep";
import { useState, useCallback } from "react";
import TestUtils from "react-dom/test-utils";

import ChartComponent from ".";

const dataPoint = {
  x: 0.000057603000000000004,
  y: 5.544444561004639,
  selectionObj: 1,
  label: "datalabel with selection id 1",
};

const props = {
  width: 500,
  height: 700,
  data: {
    datasets: [
      {
        borderColor: "#4e98e2",
        label: "/turtle1/pose.x",
        key: "0",
        showLine: true,
        fill: false,
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
    responsiveAnimationDuration: 0,
    legend: { display: false },
    elements: { line: { tension: 0 } },
    annotations: { annotations: [] },
    plugins: {
      datalabels: {
        anchor: "start",
        align: 0,
        offset: 5,
        color: "white",
      },
    } as Chart.ChartPluginsOptions,
    scales: {
      yAxes: [
        {
          id: "Y_AXIS_ID",
          ticks: {
            fontFamily: `"Roboto Mono", Menlo, Inconsolata, "Courier New", Courier, monospace`,
            fontSize: 10,
            fontColor: "#eee",
            padding: 0,
            precision: 3,
          },
          gridLines: {
            color: "rgba(255, 255, 255, 0.2)",
            zeroLineColor: "rgba(255, 255, 255, 0.2)",
          },
        },
      ],
      xAxes: [
        {
          ticks: {
            fontFamily: `"Roboto Mono", Menlo, Inconsolata, "Courier New", Courier, monospace`,
            fontSize: 10,
            fontColor: "#eee",
            maxRotation: 0,
          },
          gridLines: {
            color: "rgba(255, 255, 255, 0.2)",
            zeroLineColor: "rgba(255, 255, 255, 0.2)",
          },
        },
      ],
    },
  },
  type: "scatter",
};

const propsWithDatalabels = cloneDeep(props);
propsWithDatalabels.data.datasets[0]!.datalabels.display = true;

const divStyle = { width: 600, height: 800, background: "black" };

function DatalabelUpdateExample({
  forceDisableWorkerRendering,
}: {
  forceDisableWorkerRendering: boolean;
}) {
  const [hasRenderedOnce, setHasRenderedOnce] = useState<boolean>(false);
  const refFn = useCallback(() => {
    setTimeout(() => setHasRenderedOnce(true), 200);
  }, []);

  const chartProps = cloneDeep(props);
  if (hasRenderedOnce) {
    chartProps.data.datasets[0]!.data[0]!.x++;
  }
  return (
    <div style={divStyle} ref={refFn}>
      <ChartComponent {...chartProps} forceDisableWorkerRendering={forceDisableWorkerRendering} />
    </div>
  );
}

function DatalabelClickExample() {
  const [clickedDatalabel, setClickedDatalabel] = useState<any>(null);
  const refFn = useCallback(() => {
    setTimeout(() => {
      if (!clickedDatalabel) {
        const [canvas] = document.getElementsByTagName("canvas");
        TestUtils.Simulate.click(canvas!, { clientX: 245, clientY: 419 });
      }
    }, 200);
  }, [clickedDatalabel]);

  return (
    <div style={divStyle} ref={refFn}>
      <div style={{ padding: 6, fontSize: 16 }}>
        {clickedDatalabel
          ? `Clicked datalabel with selection id: ${String(clickedDatalabel.selectionObj)}`
          : "Have not clicked datalabel"}
      </div>
      <ChartComponent
        {...propsWithDatalabels}
        onClick={(_, datalabel) => {
          setClickedDatalabel(datalabel);
        }}
      />
    </div>
  );
}

storiesOf("<ChartComponent>", module)
  .addParameters({
    screenshot: {
      delay: 1500,
    },
  })
  .add("default", () => (
    <div style={divStyle}>
      <ChartComponent {...props} />
    </div>
  ))
  .add("can update", () => <DatalabelUpdateExample forceDisableWorkerRendering={false} />)
  .add("[web worker disabled] can update", () => (
    <DatalabelUpdateExample forceDisableWorkerRendering />
  ))
  .add("with datalabels", () => (
    <div style={divStyle}>
      <ChartComponent {...propsWithDatalabels} />
    </div>
  ))
  .add("allows clicking on datalabels", () => <DatalabelClickExample />);
