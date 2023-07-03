// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme } from "@mui/material";
import { Meta, StoryFn, StoryObj } from "@storybook/react";
import { userEvent } from "@storybook/testing-library";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import Panel from "@foxglove/studio-base/components/Panel";
import { PanelCatalog as PanelCatalogComponent } from "@foxglove/studio-base/components/PanelCatalog";
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

type Args = {
  mode?: "grid" | "list";
  inputValue?: string;
  events?: string[];
};

export default {
  title: "components/PanelList",
  component: ({ mode }) => <PanelCatalogComponent mode={mode} onPanelSelect={() => {}} />,
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
  play: async ({ args }) => {
    const { keyboard } = userEvent.setup();
    if (args.inputValue) {
      await keyboard(args.inputValue);
    }
    args.events?.map(async (keypress) => await keyboard(keypress));
  },
} as Meta<Args>;

type Story = StoryObj<Args>;

export const List: Story = {
  name: "Panel list",
};

export const PanelGrid: Story = {
  args: { mode: "grid" },
};

export const FilteredPanelList: Story = {
  args: { inputValue: "AAA" },
};

export const FilteredPanelGrid: Story = {
  args: { mode: "grid", inputValue: "AAA" },
};

export const FilteredPanelGridWithDescription: Story = {
  args: { mode: "grid", inputValue: "description" },
};

export const FilteredPanelListLight: Story = {
  args: { inputValue: "AAA" },
  parameters: { colorScheme: "light" },
};

export const NavigatingArrows: Story = {
  args: { events: ["[ArrowDown]", "[ArrowDown]", "[ArrowUp]"] },
  name: "Navigating panel list with arrow keys",
};

export const NavigatingArrowsWrap: Story = {
  args: { events: ["[ArrowUp]"] },
  name: "Navigating up from top of panel list will scroll to highlighted last item",
};

export const NoResultsFirst: Story = {
  args: { inputValue: "regular" },
  name: "Filtered panel list without results in 1st category",
};

export const NoResultsLast: Story = {
  args: { inputValue: "preconfigured" },
  name: "Filtered panel list without results in last category",
};

export const NoResultsAnyList: Story = {
  args: { inputValue: "WWW" },
  name: "Filtered panel list without results in any category",
};

export const NoResultsAnyGrid: Story = {
  args: { mode: "grid", inputValue: "WWW" },
  name: "Filtered panel grid without results in any category",
};

export const CaseInsensitiveFilter: Story = {
  args: { inputValue: "pA" },
  name: "Case-insensitive filtering and highlight submenu",
};

export const PanelListChinese: Story = {
  parameters: { forceLanguage: "zh" },
};

export const PanelListJapanese: Story = {
  parameters: { forceLanguage: "ja" },
};

export const NoResultsChinese: Story = {
  ...NoResultsAnyGrid,
  parameters: { forceLanguage: "zh" },
};

export const NoResultsJapanese: Story = {
  ...NoResultsAnyGrid,
  parameters: { forceLanguage: "ja" },
};
