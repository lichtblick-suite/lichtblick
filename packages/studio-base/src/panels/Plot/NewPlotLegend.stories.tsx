// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story } from "@storybook/react";
import { useCallback, useState } from "react";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import Stack from "@foxglove/studio-base/components/Stack";
import AppConfigurationContext from "@foxglove/studio-base/context/AppConfigurationContext";
import Plot, { PlotConfig } from "@foxglove/studio-base/panels/Plot";
import { fixture, paths } from "@foxglove/studio-base/panels/Plot/index.stories";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import { useReadySignal } from "@foxglove/studio-base/stories/ReadySignalContext";
import { makeMockAppConfiguration } from "@foxglove/studio-base/util/makeMockAppConfiguration";

export default {
  title: "panels/Plot/NewPlotLegend",
  component: Plot,
  parameters: {
    chromatic: { delay: 50 },
  },
  decorators: [Wrapper],
};

const exampleConfig: PlotConfig = {
  paths,
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

function Wrapper(StoryFn: Story): JSX.Element {
  const readySignal = useReadySignal({ count: 3 });
  const pauseFrame = useCallback(() => readySignal, [readySignal]);
  const [appConfig] = useState(() =>
    makeMockAppConfiguration([[AppSetting.ENABLE_PLOT_PANEL_SERIES_SETTINGS, true]]),
  );

  return (
    <PanelSetup fixture={fixture} pauseFrame={pauseFrame}>
      <AppConfigurationContext.Provider value={appConfig}>
        <StoryFn />
      </AppConfigurationContext.Provider>
    </PanelSetup>
  );
}

function Default(): JSX.Element {
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

export function Light(): JSX.Element {
  return <Default />;
}
Light.storyName = "New Plot Legend (Light)";
Light.parameters = { useReadySignal: true, colorScheme: "light" };

export function Dark(): JSX.Element {
  return <Default />;
}
Dark.storyName = "New Plot Legend (Dark)";
Dark.parameters = { useReadySignal: true, colorScheme: "dark" };
