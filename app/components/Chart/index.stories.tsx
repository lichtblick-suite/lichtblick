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
import { useState, useCallback, ComponentProps } from "react";
import TestUtils from "react-dom/test-utils";

import ChartComponent from ".";

const dataPoint = {
  x: 0.000057603000000000004,
  y: 5.544444561004639,
  selectionObj: 1,
  label: "datalabel with selection id 1",
};

const props: ComponentProps<typeof ChartComponent> = {
  width: 500,
  height: 700,
  data: {
    datasets: [
      {
        borderColor: "#4e98e2",
        label: "/turtle1/pose.x",
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
            family: `"Roboto Mono", Menlo, Inconsolata, "Courier New", Courier, monospace`,
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
            family: `"Roboto Mono", Menlo, Inconsolata, "Courier New", Courier, monospace`,
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

const propsWithDatalabels = cloneDeep(props);
if (propsWithDatalabels.data.datasets[0]?.datalabels) {
  propsWithDatalabels.data.datasets[0].datalabels.display = true;
}

const divStyle = { width: 600, height: 800, background: "black" };

function DatalabelUpdateExample() {
  const [hasRenderedOnce, setHasRenderedOnce] = useState<boolean>(false);
  const refFn = useCallback(() => {
    setTimeout(() => setHasRenderedOnce(true), 200);
  }, []);

  const chartProps = cloneDeep(props);
  if (hasRenderedOnce) {
    if (
      chartProps.data.datasets[0]?.data[0] != undefined &&
      typeof chartProps.data.datasets[0]?.data[0] !== "number"
    ) {
      chartProps.data.datasets[0].data[0].x++;
    }
  }
  return (
    <div style={divStyle} ref={refFn}>
      <ChartComponent {...chartProps} />
    </div>
  );
}

function DatalabelClickExample() {
  const [clickedDatalabel, setClickedDatalabel] = useState<any>(undefined);
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
        onClick={(datalabel) => {
          setClickedDatalabel(datalabel ?? undefined);
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
  .add("can update", () => <DatalabelUpdateExample />)
  .add("with datalabels", () => (
    <div style={divStyle}>
      <ChartComponent {...propsWithDatalabels} />
    </div>
  ))
  .add("allows clicking on datalabels", () => <DatalabelClickExample />);
