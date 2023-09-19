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

import { useTheme } from "@mui/material";
import { StoryObj, Meta } from "@storybook/react";
import { fireEvent, within } from "@storybook/testing-library";

import Panel from "@foxglove/studio-base/components/Panel";
import { PanelCatalog as PanelCatalogComponent } from "@foxglove/studio-base/components/PanelCatalog";
import PanelLayout from "@foxglove/studio-base/components/PanelLayout";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import { PanelCatalog, PanelInfo } from "@foxglove/studio-base/context/PanelCatalogContext";
import {
  nestedTabLayoutFixture,
  nestedTabLayoutFixture2,
} from "@foxglove/studio-base/panels/Tab/nestedTabLayoutFixture";
import { TabPanelConfig } from "@foxglove/studio-base/src/types/layouts";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";
import { ExpectedResult } from "@foxglove/studio-base/stories/storyHelpers";

import Tab from "./index";

const SamplePanel1 = () => (
  <div>
    <PanelToolbar />
    <div>Sample Panel 1</div>
  </div>
);
SamplePanel1.panelType = "Sample1";
SamplePanel1.defaultConfig = {};

const SamplePanel2 = () => (
  <div>
    <PanelToolbar />
    <div>Sample Panel 2</div>
  </div>
);
SamplePanel2.panelType = "Sample2";
SamplePanel2.defaultConfig = {};

const MockPanel1 = Panel(SamplePanel1);
const MockPanel2 = Panel(SamplePanel2);

const allPanels: readonly PanelInfo[] = [
  { title: "Some Panel", type: "Sample1", module: async () => ({ default: MockPanel1 }) },
  { title: "Happy Panel", type: "Sample2", module: async () => ({ default: MockPanel2 }) },
  { title: "Tab", type: "Tab", module: async () => ({ default: Tab }) },
];

function dragAndDrop(source: Element, target: Element): void {
  fireEvent.dragStart(source);
  fireEvent.drop(target);
}

class MockPanelCatalog implements PanelCatalog {
  public getPanels(): readonly PanelInfo[] {
    return allPanels;
  }
  public getPanelByType(type: string): PanelInfo | undefined {
    return allPanels.find((panel) => !panel.config && panel.type === type);
  }
}

const fixture = { topics: [], datatypes: new Map(), frame: {}, layout: "Tab!a" };
const manyTabs = new Array(25)
  .fill(1)
  .map((_elem, idx) => ({ title: `Tab #${idx + 1}`, layout: undefined }));

type StoryArgs = {
  disableMockCatalog?: boolean;
  fixture?: Fixture;
  showPanelList?: boolean;
  overrideConfig?: TabPanelConfig;
};

export default {
  title: "panels/Tab",
  parameters: {
    chromatic: {
      delay: 1000,
    },
    colorScheme: "dark",
  },
  decorators: [
    (Wrapped, ctx) => {
      const {
        args: {
          disableMockCatalog = false,
          showPanelList = false,
          fixture: fixtureArg,
          ...storyArgs
        },
      } = ctx;
      const panelCatalog = !disableMockCatalog ? new MockPanelCatalog() : undefined;
      const theme = useTheme();

      return (
        <PanelSetup panelCatalog={panelCatalog} fixture={fixtureArg}>
          <Wrapped {...storyArgs} />
          {showPanelList && (
            <div
              style={{
                backgroundColor: theme.palette.background.paper,
                borderInlineStart: `1px solid ${theme.palette.divider}`,
              }}
            >
              <PanelCatalogComponent onPanelSelect={() => {}} />
            </div>
          )}
        </PanelSetup>
      );
    },
  ],
} satisfies Meta<StoryArgs>;

type Story = StoryObj<StoryArgs>;

export const Default: Story = {
  render: () => <Tab />,
  args: { disableMockCatalog: true },
  name: "default",
  parameters: { colorScheme: "both-row" },
};

export const ShowingPanelList: Story = {
  render: () => <Tab />,
  args: { fixture },
  name: "showing panel list",
};

export const ShowingPanelListLight: Story = {
  ...ShowingPanelList,
  name: "showing panel list light",
  parameters: { colorScheme: "light" },
};

export const PickingAPanelFromThePanelListCreatesANewTabIfThereAreNone: Story = {
  render: () => <PanelLayout />,
  args: {
    fixture: {
      ...fixture,
      savedProps: { "Tab!a": { activeTabIdx: -1, tabs: [] } },
    },
  },
  name: "picking a panel from the panel list creates a new tab if there are none",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const panel = await canvas.findAllByTestId("panel-grid-card Some Panel");
    fireEvent.click(panel[0]!);
  },
};

export const PickingAPanelFromThePanelListUpdatesTheTabsLayout: Story = {
  render: () => <PanelLayout />,
  args: {
    fixture: {
      ...fixture,
      savedProps: {
        "Tab!a": { activeTabIdx: 0, tabs: [{ title: "First tab", layout: undefined }] },
      },
    },
  },
  name: "picking a panel from the panel list updates the tab's layout",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const panel = await canvas.findAllByTestId("panel-grid-card Some Panel");
    fireEvent.click(panel[0]!);
  },
};

export const DraggingAPanelFromThePanelListUpdatesTheTabsLayout: Story = {
  render: () => <PanelLayout />,
  args: {
    showPanelList: true,
    fixture: {
      ...fixture,
      savedProps: {
        "Tab!a": { activeTabIdx: 0, tabs: [{ title: "First tab", layout: undefined }] },
      },
    },
  },
  name: "dragging a panel from the panel list updates the tab's layout",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const imageItem = await canvas.findAllByTestId("panel-menu-item Some Panel");
    const panel = await canvas.findAllByTestId("empty-drop-target");

    dragAndDrop(imageItem[0]!, panel[0]!);
  },
};

export const DraggingAPanelFromThePanelListCreatesANewTabIfThereAreNone: Story = {
  render: () => <PanelLayout />,
  args: {
    showPanelList: true,
    fixture: {
      ...fixture,
      savedProps: { "Tab!a": { activeTabIdx: -1, tabs: [] } },
    },
  },
  name: "dragging a panel from the panel list creates a new tab if there are none",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const imageItem = await canvas.findAllByTestId("panel-menu-item Some Panel");
    const panel = await canvas.findAllByTestId("empty-drop-target");

    dragAndDrop(imageItem[0]!, panel[0]!);
  },
};

export const WithChosenActiveTab: Story = {
  render: (args) => <Tab {...args} />,
  args: {
    overrideConfig: {
      activeTabIdx: 1,
      tabs: [
        { title: "Tab A", layout: undefined },
        {
          title: "Tab B",
          layout: {
            direction: "row",
            first: {
              direction: "column",
              first: "Sample1!2xqjjqw",
              second: "Sample2!81fx2n",
              splitPercentage: 60,
            },
            second: {
              direction: "column",
              first: "Sample2!3dor2gy",
              second: "Sample1!3wrafzj",
              splitPercentage: 40,
            },
          },
        },
        { title: "Tab C", layout: undefined },
      ],
    },
  },
  name: "with chosen active tab",
  parameters: { colorScheme: "both-row" },
};

export const AddTab: Story = {
  render: () => <PanelLayout />,
  args: {
    fixture: {
      ...fixture,
      savedProps: { "Tab!a": { activeTabIdx: 0, tabs: [{ title: "Tab A", layout: undefined }] } },
    },
  },
  name: "add tab",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    fireEvent.click(await canvas.findByTestId("add-tab"));
  },
};

export const RemoveTab: Story = {
  render: () => <PanelLayout />,
  args: {
    fixture: {
      ...fixture,
      savedProps: { "Tab!a": { activeTabIdx: 0, tabs: manyTabs.slice(0, 5) } },
    },
  },
  name: "remove tab",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    fireEvent.click(await canvas.findByTestId("tab-icon"));
  },
};

export const ReorderTabsWithinTabPanelByDroppingOnTab: Story = {
  render: () => (
    <>
      <PanelLayout />
      <ExpectedResult>Expected result: #2, #3, #1, #4, #5</ExpectedResult>
    </>
  ),
  args: {
    fixture: {
      ...fixture,
      savedProps: { "Tab!a": { activeTabIdx: 0, tabs: manyTabs.slice(0, 5) } },
    },
  },
  name: "reorder tabs within Tab panel by dropping on tab",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = await canvas.findAllByTestId("toolbar-tab");

    // Drag and drop the first tab onto the third tab
    dragAndDrop(tabs[0]!, tabs[2]!);
  },
};

export const MoveTabToDifferentTabPanel: Story = {
  render: () => (
    <>
      <PanelLayout />
      <ExpectedResult left={0}>Should have only #2</ExpectedResult>
      <ExpectedResult left="50%">Should have #1 and #3</ExpectedResult>
    </>
  ),
  name: "move tab to different Tab panel",
  args: {
    fixture: {
      ...fixture,
      layout: { first: "Tab!a", second: "Tab!b", direction: "row", splitPercentage: 50 },
      savedProps: {
        "Tab!a": { activeTabIdx: 0, tabs: manyTabs.slice(0, 2) },
        "Tab!b": { activeTabIdx: 0, tabs: manyTabs.slice(2, 3) },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = await canvas.findAllByTestId("toolbar-tab");
    dragAndDrop(tabs[0]!, tabs[2]!);
  },
};

export const PreventDraggingSelectedParentTabIntoChildTabPanel: Story = {
  render: () => (
    <>
      <PanelLayout />
      <ExpectedResult>the first tab should be hidden (we never dropped it)</ExpectedResult>
      <ExpectedResult top={50}>tab content should be hidden</ExpectedResult>
    </>
  ),
  args: {
    fixture: {
      ...fixture,
      savedProps: {
        "Tab!a": { activeTabIdx: 0, tabs: [{ title: "Parent tab", layout: "Tab!b" }, manyTabs[0]] },
        "Tab!b": { activeTabIdx: 0, tabs: manyTabs.slice(3, 6) },
      },
    },
  },
  name: "prevent dragging selected parent tab into child tab panel",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabs = await canvas.findAllByTestId("toolbar-tab");

    fireEvent.dragStart(tabs[0]!);

    try {
      fireEvent.dragOver(tabs[2]!);
    } catch (error) {
      if (error.message === "ignoredException") {
        // supress this error specifically as it is the expected behavior
        return;
      }
      throw error;
    }
  },
};

export const DraggingAndDroppingANestedTabPanelDoesNotRemoveAnyTabs: Story = {
  render: () => <PanelLayout />,
  name: "dragging and dropping a nested tab panel does not remove any tabs",
  args: { fixture: nestedTabLayoutFixture },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tabLeft = await canvas.findByTestId("panel-mouseenter-container Tab!Left");
    const tabRightInner = await canvas.findByTestId("panel-mouseenter-container Tab!RightInner");

    fireEvent.click(await within(tabLeft).findByTestId("add-tab"));
    const dragHandle = await within(tabRightInner).findAllByTestId("panel-menu");
    const target = await within(tabLeft).findByTestId("empty-drop-target");

    dragAndDrop(dragHandle[0]!, target);
  },
};

export const SupportsDraggingBetweenTabsAnywhereInTheLayout: Story = {
  render: () => <PanelLayout />,
  args: { fixture: nestedTabLayoutFixture2 },
  name: "supports dragging between tabs anywhere in the layout",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sample1 = await canvas.findByTestId("panel-mouseenter-container Sample1");
    const targetTab = await canvas.findByTestId("panel-mouseenter-container Tab!b");

    const dragHandle = await within(sample1).findAllByTestId("panel-menu");
    const target = targetTab.querySelector(".drop-target.left");

    dragAndDrop(dragHandle[0]!, target!);
  },
};
