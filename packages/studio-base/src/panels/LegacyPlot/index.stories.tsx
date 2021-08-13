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

import PanelSetup, { triggerWheel } from "@foxglove/studio-base/stories/PanelSetup";

import TwoDimensionalPlot from "./index";

const example0 = {
  title: "This is Plot A",
  xAxisLabel: "This is my X axis label",
  yAxisLabel: "This is my Y axis label",
  lines: [
    {
      label: "solid-line",
      borderColor: "red",
      backgroundColor: "red",
      data: [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
      ],
    },
    {
      order: 1,
      label: "dashed-line",
      borderDash: [5, 5],
      borderColor: "pink",
      backgroundColor: "pink",
      data: [
        { x: 1, y: 1.5 },
        { x: 5, y: 3.5 },
      ],
    },
  ],
  points: [
    {
      label: "circle-point",
      pointBackgroundColor: "blue",
      data: [
        { x: 1.5, y: 2.5 },
        { x: 3, y: 4 },
        { x: 4, y: 3.5 },
      ],
    },
    {
      label: "cross-point",
      pointBackgroundColor: "teal",
      pointBorderColor: "teal",
      pointBorderWidth: 3,
      pointStyle: "star",
      pointRadius: 10,
      data: [
        { x: 2, y: 1 },
        { x: 4, y: 1 },
      ],
    },
  ],
};

const example1 = {
  lines: [
    // This also has a solid-line, but with completely different dimensions. If we don't properly
    // clone these objects, Chart.js might mutate the object above because the label is the same.
    {
      label: "solid-line",
      data: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
      ],
    },
  ],
};

const fixture = {
  topics: [{ name: "/plot_a", datatype: "our_plot_type" }],
  datatypes: new Map(
    Object.entries({
      our_plot_type: {
        definitions: [{ isArray: true, isComplex: true, name: "versions", type: "dummy" }],
      },
      dummy: { definitions: [] },
    }),
  ),
  frame: {
    "/plot_a": [
      {
        topic: "/plot_a",
        receiveTime: { sec: 1532375120, nsec: 317760607 },
        message: {
          versions: [example0, example1],
        },
      },
    ],
  },
};

function zoomOut(keyObj: any) {
  const canvasEl = document.querySelector("canvas");

  // Zoom is a continuous event, so we need to simulate wheel multiple times
  if (canvasEl) {
    if (keyObj) {
      document.dispatchEvent(new KeyboardEvent("keydown", keyObj));
    }

    for (let i = 0; i < 5; i++) {
      triggerWheel(canvasEl, 1);
    }
  }
}

export default {
  title: "panels/LegacyPlot",
  parameters: {
    chromatic: {
      delay: 2500,
    },
  },
};

export const basic = (): JSX.Element => {
  return (
    <PanelSetup fixture={fixture}>
      <TwoDimensionalPlot overrideConfig={{ path: { value: "/plot_a.versions[0]" } }} />
    </PanelSetup>
  );
};

export const customMinMaxWindow = (): JSX.Element => {
  return (
    <PanelSetup fixture={fixture}>
      <TwoDimensionalPlot
        overrideConfig={{
          path: { value: "/plot_a.versions[0]" },
          minXVal: "0.5",
          maxXVal: "6.5",
          minYVal: "0.5",
          maxYVal: "4.5",
        }}
      />
    </PanelSetup>
  );
};

export const customMinMaxVal = (): JSX.Element => {
  return (
    <PanelSetup fixture={fixture}>
      <TwoDimensionalPlot
        overrideConfig={{ path: { value: "/plot_a.versions[0]" }, maxYVal: "10" }}
      />
    </PanelSetup>
  );
};

export const emptyTopic = (): JSX.Element => {
  return (
    <PanelSetup fixture={fixture}>
      <TwoDimensionalPlot overrideConfig={{ path: { value: "/plot_b" } }} />
    </PanelSetup>
  );
};

export const withTooltip = (): JSX.Element => {
  return (
    <div
      style={{ width: 300, height: 300 }}
      ref={() => {
        setTimeout(() => {
          const [canvas] = document.getElementsByTagName("canvas");
          const x = 105;
          const y = 190;
          canvas?.dispatchEvent(
            new MouseEvent("mousemove", { pageX: x, pageY: y, clientX: x, clientY: y } as any),
          );
        }, 100);
      }}
    >
      <PanelSetup fixture={fixture}>
        <TwoDimensionalPlot overrideConfig={{ path: { value: "/plot_a.versions[0]" } }} />
      </PanelSetup>
    </div>
  );
};

export const showResetAfterHorizontalZoom = (): JSX.Element => {
  return (
    <PanelSetup
      fixture={fixture}
      onMount={() => {
        setTimeout(zoomOut, 200);
      }}
    >
      <TwoDimensionalPlot overrideConfig={{ path: { value: "/plot_a.versions[0]" } }} />
    </PanelSetup>
  );
};
export const showResetAfterVerticalZoom = (): JSX.Element => {
  return (
    <PanelSetup
      fixture={fixture}
      onMount={() => {
        setTimeout(
          () => zoomOut({ key: "v", code: "KeyV", keyCode: 86, ctrlKey: false, metaKey: false }),
          200,
        );
      }}
    >
      <TwoDimensionalPlot overrideConfig={{ path: { value: "/plot_a.versions[0]" } }} />
    </PanelSetup>
  );
};
export const showResetZoom = (): JSX.Element => {
  return (
    <PanelSetup
      fixture={fixture}
      onMount={() => {
        setTimeout(
          () => zoomOut({ key: "b", code: "KeyB", keyCode: 66, ctrlKey: false, metaKey: false }),
          200,
        );
      }}
    >
      <TwoDimensionalPlot overrideConfig={{ path: { value: "/plot_a.versions[0]" } }} />
    </PanelSetup>
  );
};

export const resetZoom = (): JSX.Element => {
  return (
    <PanelSetup
      fixture={fixture}
      onMount={(el: any) => {
        setTimeout(zoomOut, 200);
        setTimeout(() => {
          const resetZoomBtn = el.querySelector("button");
          if (resetZoomBtn) {
            resetZoomBtn.click();
          }
        }, 400);
      }}
    >
      <TwoDimensionalPlot overrideConfig={{ path: { value: "/plot_a.versions[0]" } }} />
    </PanelSetup>
  );
};
