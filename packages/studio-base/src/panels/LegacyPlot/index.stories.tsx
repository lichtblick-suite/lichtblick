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

import { useCallback, useRef } from "react";

import PanelSetup, { Fixture, triggerWheel } from "@foxglove/studio-base/stories/PanelSetup";
import { useReadySignal } from "@foxglove/studio-base/stories/ReadySignalContext";

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

const fixture: Fixture = {
  topics: [{ name: "/plot_a", schemaName: "our_plot_type" }],
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
        schemaName: "our_plot_type",
        sizeInBytes: 0,
      },
    ],
  },
};

function zoomOut(keyObj?: KeyboardEventInit) {
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
      delay: 100,
    },
  },
};

Basic.parameters = { useReadySignal: true };
export function Basic(): JSX.Element {
  const readySignal = useReadySignal();
  return (
    <PanelSetup fixture={fixture}>
      <TwoDimensionalPlot
        overrideConfig={{ path: { value: "/plot_a.versions[0]" } }}
        onFinishRender={readySignal}
      />
    </PanelSetup>
  );
}

CustomMinMaxWindow.parameters = { useReadySignal: true };
export function CustomMinMaxWindow(): JSX.Element {
  const readySignal = useReadySignal();
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
        onFinishRender={readySignal}
      />
    </PanelSetup>
  );
}

CustomMinMaxVal.parameters = { useReadySignal: true };
export function CustomMinMaxVal(): JSX.Element {
  const readySignal = useReadySignal();
  return (
    <PanelSetup fixture={fixture}>
      <TwoDimensionalPlot
        overrideConfig={{ path: { value: "/plot_a.versions[0]" }, maxYVal: "10" }}
        onFinishRender={readySignal}
      />
    </PanelSetup>
  );
}

export function EmptyTopic(): JSX.Element {
  return (
    <PanelSetup fixture={fixture}>
      <TwoDimensionalPlot overrideConfig={{ path: { value: "/plot_b" } }} />
    </PanelSetup>
  );
}

WithTooltip.parameters = { useReadySignal: true, colorScheme: "dark" };
export function WithTooltip(): JSX.Element {
  const readySignal = useReadySignal();
  return (
    <div
      style={{ width: 300, height: 300 }}
      ref={() => {
        setTimeout(() => {
          const [canvas] = document.getElementsByTagName("canvas");
          const x = 105;
          const y = 190;
          canvas?.dispatchEvent(
            new MouseEvent("mousemove", {
              pageX: x,
              pageY: y,
              clientX: x,
              clientY: y,
            } as MouseEventInit),
          );
        }, 100);
      }}
    >
      <PanelSetup fixture={fixture}>
        <TwoDimensionalPlot
          overrideConfig={{ path: { value: "/plot_a.versions[0]" } }}
          onFinishRender={readySignal}
        />
      </PanelSetup>
    </div>
  );
}

type StepFn = () => void;
function useStepSequence(...steps: StepFn[]): () => void {
  const stepsRef = useRef(steps);
  const stepIndexRef = useRef(0);
  return useCallback(() => {
    const step = stepsRef.current[stepIndexRef.current++];
    if (!step) {
      throw new Error("No more steps");
    }
    step();
  }, []);
}

ShowResetAfterHorizontalZoom.parameters = { useReadySignal: true, colorScheme: "dark" };
export function ShowResetAfterHorizontalZoom(): JSX.Element {
  const readySignal = useReadySignal();

  const step = useStepSequence(zoomOut, readySignal);
  return (
    <PanelSetup fixture={fixture}>
      <TwoDimensionalPlot
        overrideConfig={{ path: { value: "/plot_a.versions[0]" } }}
        onFinishRender={step}
      />
    </PanelSetup>
  );
}
ShowResetAfterVerticalZoom.parameters = { useReadySignal: true, colorScheme: "dark" };
export function ShowResetAfterVerticalZoom(): JSX.Element {
  const readySignal = useReadySignal({ count: 2 });
  const step = useStepSequence(
    useCallback(() => {
      zoomOut({ key: "v", code: "KeyV", keyCode: 86, ctrlKey: false, metaKey: false });
    }, []),
    readySignal,
    readySignal,
  );

  return (
    <PanelSetup fixture={fixture}>
      <TwoDimensionalPlot
        overrideConfig={{ path: { value: "/plot_a.versions[0]" } }}
        onFinishRender={step}
      />
    </PanelSetup>
  );
}
ShowResetZoom.parameters = { useReadySignal: true, colorScheme: "dark" };
export function ShowResetZoom(): JSX.Element {
  const readySignal = useReadySignal({ count: 2 });
  const step = useStepSequence(
    useCallback(() => {
      zoomOut({ key: "b", code: "KeyB", keyCode: 66, ctrlKey: false, metaKey: false });
    }, []),
    readySignal,
    readySignal,
  );

  return (
    <PanelSetup fixture={fixture}>
      <TwoDimensionalPlot
        overrideConfig={{ path: { value: "/plot_a.versions[0]" } }}
        onFinishRender={step}
      />
    </PanelSetup>
  );
}

ResetZoom.parameters = { useReadySignal: true, colorScheme: "dark" };
export function ResetZoom(): JSX.Element {
  const readySignal = useReadySignal();

  const elRef = useRef<HTMLDivElement | ReactNull>();

  const step = useStepSequence(
    zoomOut,
    useCallback(() => {
      elRef.current?.querySelector<HTMLButtonElement>("button[data-testid='reset-zoom']")?.click();
    }, []),
    readySignal,
  );

  return (
    <PanelSetup
      fixture={fixture}
      onMount={(el) => {
        elRef.current = el;
      }}
    >
      <TwoDimensionalPlot
        overrideConfig={{ path: { value: "/plot_a.versions[0]" } }}
        onFinishRender={step}
      />
    </PanelSetup>
  );
}
