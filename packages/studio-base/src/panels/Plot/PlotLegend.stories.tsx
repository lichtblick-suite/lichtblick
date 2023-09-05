// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj, StoryFn } from "@storybook/react";
import { waitFor } from "@storybook/testing-library";
import { useCallback } from "react";

import Stack from "@foxglove/studio-base/components/Stack";
import Plot, { PlotConfig } from "@foxglove/studio-base/panels/Plot";
import { fixture, paths } from "@foxglove/studio-base/panels/Plot/index.stories";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import { useReadySignal } from "@foxglove/studio-base/stories/ReadySignalContext";

export default {
  title: "panels/Plot/PlotLegend",
  component: Plot,
  parameters: {
    chromatic: { delay: 50 },
  },
};

const labeledPaths = paths.map((path, index) => {
  if (index % 2 === 0) {
    return path;
  } else {
    return { ...path, label: `Label ${index}` };
  }
});

const exampleConfig: PlotConfig = {
  paths: labeledPaths,
  xAxisVal: "timestamp",
  showLegend: true,
  isSynced: true,
  legendDisplay: "floating",
  showXAxisLabels: true,
  showYAxisLabels: true,
  showPlotValuesInLegend: false,
  sidebarDimension: 0,
  minYValue: -1,
  maxYValue: 1,
  minXValue: 0,
  maxXValue: 3,
};

function Wrapper(Wrapped: StoryFn): JSX.Element {
  const readySignal = useReadySignal({ count: 20 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);

  return (
    <PanelSetup fixture={fixture} pauseFrame={pauseFrame}>
      <Wrapped />
    </PanelSetup>
  );
}

function Default() {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "grid",
        gap: 4,
        gridTemplateAreas: `
            "floating floating top top"
            "left left left squished"
          `,
        gridTemplateColumns: "1fr 1fr 1fr 1fr",
        gridTemplateRows: "1fr 1fr",
      }}
    >
      <Stack style={{ gridArea: "floating" }}>
        <Plot overrideConfig={{ ...exampleConfig, legendDisplay: "floating" }} />
      </Stack>
      <Stack style={{ gridArea: "left" }}>
        <Plot
          overrideConfig={{
            ...exampleConfig,
            legendDisplay: "left",
            showPlotValuesInLegend: true,
            sidebarDimension: 440,
          }}
        />
      </Stack>
      <Stack style={{ gridArea: "top" }}>
        <Plot
          overrideConfig={{
            ...exampleConfig,
            legendDisplay: "top",
            sidebarDimension: 205,
            showPlotValuesInLegend: true,
          }}
        />
      </Stack>
      <Stack style={{ gridArea: "squished" }}>
        <Plot
          overrideConfig={{
            ...exampleConfig,
            legendDisplay: "left",
            sidebarDimension: 150,
            showPlotValuesInLegend: true,
          }}
        />
      </Stack>
    </div>
  );
}

export const Light: StoryObj = {
  render: () => {
    return <Default />;
  },

  name: "Plot Legend (Light)",

  play: async (ctx) => {
    await ctx.parameters.storyReady;
  },

  parameters: { useReadySignal: true, colorScheme: "light" },
  decorators: [Wrapper],
};

export const Dark: StoryObj = {
  render: () => {
    return <Default />;
  },

  name: "Plot Legend (Dark)",

  play: async (ctx) => {
    await ctx.parameters.storyReady;
  },

  parameters: { useReadySignal: true, colorScheme: "dark" },
  decorators: [Wrapper],
};

export const LimitWidth: StoryObj = {
  render: function Story() {
    const readySignal = useReadySignal({ count: 6 });
    const pauseFrame = useCallback(() => readySignal, [readySignal]);

    return (
      <PanelSetup fixture={fixture} pauseFrame={pauseFrame}>
        <div
          style={{
            height: "100%",
            width: "100%",
          }}
        >
          <Plot
            overrideConfig={{ ...exampleConfig, legendDisplay: "left", sidebarDimension: 4096 }}
          />
        </div>
      </PanelSetup>
    );
  },

  play: async (ctx) => {
    await waitFor(() => ctx.parameters.storyReady);
  },

  parameters: {
    colorScheme: "light",
    useReadySignal: true,
  },
};
