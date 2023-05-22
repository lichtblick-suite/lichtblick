// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { useTheme } from "@mui/material";
import { StoryFn, StoryObj } from "@storybook/react";
import { userEvent } from "@storybook/testing-library";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import Panel from "@foxglove/studio-base/components/Panel";
import PanelList from "@foxglove/studio-base/components/PanelList";
import PanelCatalogContext, {
  PanelCatalog,
  PanelInfo,
} from "@foxglove/studio-base/context/PanelCatalogContext";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";

const SamplePanel1 = () => <div />;
SamplePanel1.panelType = "sample";
SamplePanel1.defaultConfig = {};

const SamplePanel2 = () => <div />;
SamplePanel2.panelType = "sample2";
SamplePanel2.defaultConfig = {};

const MockPanel1 = Panel(SamplePanel1);
const MockPanel2 = Panel(SamplePanel2);

const allPanels: PanelInfo[] = [
  { title: "Regular Panel BBB", type: "Sample1", module: async () => ({ default: MockPanel1 }) },
  { title: "Regular Panel AAA", type: "Sample2", module: async () => ({ default: MockPanel2 }) },
  {
    title: "Preconfigured Panel AAA",
    type: "Sample1",
    description: "Panel description",
    module: async () => ({ default: MockPanel1 }),
    config: { text: "def" },
  },
  {
    title: "Preconfigured Panel BBB",
    type: "Sample2",
    module: async () => ({ default: MockPanel1 }),
    config: { num: 456 },
  },
];

class MockPanelCatalog implements PanelCatalog {
  public getPanels(): readonly PanelInfo[] {
    return allPanels;
  }
  public getPanelByType(type: string): PanelInfo | undefined {
    return allPanels.find((panel) => !panel.config && panel.type === type);
  }
}

const PanelListStory: StoryObj<{
  mode?: "grid" | "list";
  inputValue?: string;
  events?: string[];
}> = {
  render: ({ mode }) => <PanelList mode={mode} onPanelSelect={() => {}} />,
  play: async ({ args }) => {
    if (args.inputValue) {
      userEvent.keyboard(args.inputValue);
    }
    args.events?.forEach((keypress) => userEvent.keyboard(keypress));
  },
};

export default {
  title: "components/PanelList",
  parameters: { colorScheme: "dark" },
  decorators: [
    (Wrapped: StoryFn): JSX.Element => {
      const theme = useTheme();
      return (
        <DndProvider backend={HTML5Backend}>
          <PanelCatalogContext.Provider value={new MockPanelCatalog()}>
            <MockCurrentLayoutProvider>
              <div
                style={{ margin: 50, height: 480, backgroundColor: theme.palette.background.paper }}
              >
                <Wrapped />
              </div>
            </MockCurrentLayoutProvider>
          </PanelCatalogContext.Provider>
        </DndProvider>
      );
    },
  ],
};

export const List: StoryObj = {
  ...PanelListStory,
  name: "Panel list",
};

export const PanelGrid: StoryObj = {
  ...PanelListStory,
  args: { mode: "grid" },
};

export const FilteredPanelList: StoryObj = {
  ...PanelListStory,
  args: { inputValue: "AAA" },
};

export const FilteredPanelGrid: StoryObj = {
  ...PanelListStory,
  args: { mode: "grid", inputValue: "AAA" },
};

export const FilteredPanelGridWithDescription: StoryObj = {
  ...PanelListStory,
  args: { mode: "grid", inputValue: "description" },
};

export const FilteredPanelListLight: StoryObj = {
  ...PanelListStory,
  args: { inputValue: "AAA" },
  parameters: { colorScheme: "light" },
};

export const NavigatingArrows: StoryObj = {
  ...PanelListStory,
  args: { events: ["[ArrowDown]", "[ArrowDown]", "[ArrowUp]"] },
  name: "Navigating panel list with arrow keys",
};

export const NavigatingArrowsWrap: StoryObj = {
  ...PanelListStory,
  args: { events: ["[ArrowUp]"] },
  name: "Navigating up from top of panel list will scroll to highlighted last item",
};

export const NoResultsFirst: StoryObj = {
  ...PanelListStory,
  args: { inputValue: "regular" },
  name: "Filtered panel list without results in 1st category",
};

export const NoResultsLast: StoryObj = {
  ...PanelListStory,
  args: { inputValue: "preconfigured" },
  name: "Filtered panel list without results in last category",
};

export const NoResultsAnyList: StoryObj = {
  ...PanelListStory,
  args: { inputValue: "WWW" },
  name: "Filtered panel list without results in any category",
};

export const NoResultsAnyGrid: StoryObj = {
  ...PanelListStory,
  args: { mode: "grid", inputValue: "WWW" },
  name: "Filtered panel grid without results in any category",
};

export const CaseInsensitiveFilter: StoryObj = {
  ...PanelListStory,
  args: { inputValue: "pA" },
  name: "Case-insensitive filtering and highlight submenu",
};

export const PanelListChinese: StoryObj = {
  ...PanelListStory,
  parameters: { forceLanguage: "zh" },
};

export const PanelListJapanese: StoryObj = {
  ...PanelListStory,
  parameters: { forceLanguage: "ja" },
};

export const NoResultsChinese: StoryObj = {
  ...NoResultsAnyGrid,
  parameters: { forceLanguage: "zh" },
};

export const NoResultsJapanese: StoryObj = {
  ...NoResultsAnyGrid,
  parameters: { forceLanguage: "ja" },
};
