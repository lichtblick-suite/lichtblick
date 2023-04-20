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

import { StoryObj, StoryFn } from "@storybook/react";
import { fireEvent } from "@storybook/testing-library";

import Panel from "@foxglove/studio-base/components/Panel";
import PanelLayout from "@foxglove/studio-base/components/PanelLayout";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import LayoutStorageContext from "@foxglove/studio-base/context/LayoutStorageContext";
import { PanelCatalog, PanelInfo } from "@foxglove/studio-base/context/PanelCatalogContext";
import {
  nestedTabLayoutFixture,
  nestedTabLayoutFixture2,
} from "@foxglove/studio-base/panels/Tab/nestedTabLayoutFixture";
import LayoutManagerProvider from "@foxglove/studio-base/providers/LayoutManagerProvider";
import LayoutManager from "@foxglove/studio-base/services/LayoutManager/LayoutManager";
import MockLayoutStorage from "@foxglove/studio-base/services/MockLayoutStorage";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import { SExpectedResult } from "@foxglove/studio-base/stories/storyHelpers";
import tick from "@foxglove/studio-base/util/tick";

import Tab from "./index";

const SamplePanel1 = function () {
  return (
    <div>
      <PanelToolbar />
      <div>Sample Panel 1</div>
    </div>
  );
};
SamplePanel1.panelType = "Sample1";
SamplePanel1.defaultConfig = {};

const SamplePanel2 = function () {
  return (
    <div>
      <PanelToolbar />
      <div>Sample Panel 2</div>
    </div>
  );
};
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
const DEFAULT_TIMEOUT = 200;

export default {
  title: "panels/Tab",

  parameters: {
    chromatic: {
      delay: 1000,
    },

    colorScheme: "dark",
  },

  decorators: [
    (Wrapped: StoryFn): JSX.Element => {
      const storage = new MockLayoutStorage(LayoutManager.LOCAL_STORAGE_NAMESPACE, []);

      return (
        <LayoutStorageContext.Provider value={storage}>
          <LayoutManagerProvider>
            <Wrapped />
          </LayoutManagerProvider>
        </LayoutStorageContext.Provider>
      );
    },
  ],
};

export const Default: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture}>
      <Tab />
    </PanelSetup>
  ),

  name: "default",
  parameters: { colorScheme: "both-row" },
};

export const ShowingPanelList: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture} panelCatalog={new MockPanelCatalog()}>
      <Tab />
    </PanelSetup>
  ),

  name: "showing panel list",
};

export const ShowingPanelListLight: StoryObj = {
  render: () => (
    <PanelSetup fixture={fixture} panelCatalog={new MockPanelCatalog()}>
      <Tab />
    </PanelSetup>
  ),

  name: "showing panel list light",
  parameters: { colorScheme: "light" },
};

export const PickingAPanelFromThePanelListCreatesANewTabIfThereAreNone: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        panelCatalog={new MockPanelCatalog()}
        fixture={{
          ...fixture,
          savedProps: {
            "Tab!a": {
              activeTabIdx: -1,
              tabs: [],
            },
          },
        }}
        onMount={() => {
          setTimeout(async () => {
            await tick();
            (
              document.querySelectorAll('[data-testid="panel-menu-item Some Panel"]')[0] as any
            ).click();
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
      </PanelSetup>
    );
  },

  name: "picking a panel from the panel list creates a new tab if there are none",
};

export const PickingAPanelFromThePanelListUpdatesTheTabsLayout: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        panelCatalog={new MockPanelCatalog()}
        fixture={{
          ...fixture,
          savedProps: {
            "Tab!a": {
              activeTabIdx: 0,
              tabs: [{ title: "First tab", layout: undefined }],
            },
          },
        }}
        onMount={() => {
          setTimeout(async () => {
            await tick();
            (
              document.querySelectorAll('[data-testid="panel-menu-item Some Panel"]')[0] as any
            ).click();
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
      </PanelSetup>
    );
  },

  name: "picking a panel from the panel list updates the tab's layout",
};

export const DraggingAPanelFromThePanelListUpdatesTheTabsLayout: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        panelCatalog={new MockPanelCatalog()}
        fixture={{
          ...fixture,
          savedProps: {
            "Tab!a": {
              activeTabIdx: 0,
              tabs: [{ title: "First tab", layout: undefined }],
            },
          },
        }}
        onMount={() => {
          setTimeout(async () => {
            await tick();

            const imageItem = document.querySelectorAll(
              '[data-testid="panel-menu-item Some Panel"]',
            )[0];
            const panel = document.querySelectorAll('[data-testid="empty-drop-target"]')[0];
            dragAndDrop(imageItem!, panel!);
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
      </PanelSetup>
    );
  },

  name: "dragging a panel from the panel list updates the tab's layout",
};

export const DraggingAPanelFromThePanelListCreatesANewTabIfThereAreNone: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        panelCatalog={new MockPanelCatalog()}
        fixture={{
          ...fixture,
          savedProps: {
            "Tab!a": {
              activeTabIdx: -1,
              tabs: [],
            },
          },
        }}
        onMount={() => {
          setTimeout(async () => {
            await tick();

            const imageItem = document.querySelectorAll(
              '[data-testid="panel-menu-item Some Panel"]',
            )[0];
            const panel = document.querySelectorAll('[data-testid="empty-drop-target"]')[0];
            dragAndDrop(imageItem!, panel!);
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
      </PanelSetup>
    );
  },

  name: "dragging a panel from the panel list creates a new tab if there are none",
};

export const WithChosenActiveTab: StoryObj = {
  render: () => (
    <PanelSetup panelCatalog={new MockPanelCatalog()} fixture={fixture}>
      <Tab
        overrideConfig={{
          activeTabIdx: 1,
          tabs: [
            {
              title: "Tab A",
              layout: undefined,
            },
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
            {
              title: "Tab C",
              layout: undefined,
            },
          ],
        }}
      />
    </PanelSetup>
  ),

  name: "with chosen active tab",
  parameters: { colorScheme: "both-row" },
};

export const AddTab: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        panelCatalog={new MockPanelCatalog()}
        fixture={{
          ...fixture,
          savedProps: {
            "Tab!a": { activeTabIdx: 0, tabs: [{ title: "Tab A", layout: undefined }] },
          },
        }}
        style={{ width: "100%" }}
        onMount={() => {
          setTimeout(async () => {
            const addTabBtn = document.querySelector("[data-testid=add-tab]");
            if (addTabBtn) {
              (addTabBtn as any).click();
            }
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
      </PanelSetup>
    );
  },

  name: "add tab",
};

export const RemoveTab: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        panelCatalog={new MockPanelCatalog()}
        fixture={{
          ...fixture,
          savedProps: {
            "Tab!a": { activeTabIdx: 0, tabs: manyTabs.slice(0, 5) },
          },
        }}
        style={{ width: "100%" }}
        onMount={() => {
          setTimeout(async () => {
            const removeTabBtn = document.querySelector("[data-testid=tab-icon]");
            if (removeTabBtn) {
              (removeTabBtn as any).click();
            }
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
      </PanelSetup>
    );
  },

  name: "remove tab",
};

export const ReorderTabsWithinTabPanelByDroppingOnTab: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        panelCatalog={new MockPanelCatalog()}
        fixture={{
          ...fixture,
          savedProps: {
            "Tab!a": { activeTabIdx: 0, tabs: manyTabs.slice(0, 5) },
          },
        }}
        style={{ width: "100%" }}
        onMount={() => {
          setTimeout(async () => {
            await tick();
            const tabs = document.querySelectorAll("[draggable=true]");

            // Drag and drop the first tab onto the third tab
            dragAndDrop(tabs[0]!, tabs[2]!);
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
        <SExpectedResult>Expected result: #2, #3, #1, #4, #5</SExpectedResult>
      </PanelSetup>
    );
  },

  name: "reorder tabs within Tab panel by dropping on tab",
};

export const MoveTabToDifferentTabPanel: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        panelCatalog={new MockPanelCatalog()}
        fixture={{
          ...fixture,
          layout: {
            first: "Tab!a",
            second: "Tab!b",
            direction: "row",
            splitPercentage: 50,
          },
          savedProps: {
            "Tab!a": { activeTabIdx: 0, tabs: manyTabs.slice(0, 2) },
            "Tab!b": { activeTabIdx: 0, tabs: manyTabs.slice(2, 3) },
          },
        }}
        style={{ width: "100%" }}
        onMount={() => {
          setTimeout(async () => {
            await tick();
            const tabs = document.querySelectorAll("[data-testid=toolbar-tab]");
            dragAndDrop(tabs[0]!, tabs[2]!);
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
        <SExpectedResult style={{ left: 0 }}>Should have only #2</SExpectedResult>
        <SExpectedResult style={{ left: "50%" }}>Should have #1 and #3</SExpectedResult>
      </PanelSetup>
    );
  },

  name: "move tab to different Tab panel",
};

export const PreventDraggingSelectedParentTabIntoChildTabPanel: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        panelCatalog={new MockPanelCatalog()}
        fixture={{
          ...fixture,
          savedProps: {
            "Tab!a": {
              activeTabIdx: 0,
              tabs: [{ title: "Parent tab", layout: "Tab!b" }, manyTabs[0]],
            },
            "Tab!b": { activeTabIdx: 0, tabs: manyTabs.slice(3, 6) },
          },
        }}
        style={{ width: "100%" }}
        onMount={() => {
          setTimeout(async () => {
            await tick();
            const tabs = document.querySelectorAll("[draggable=true]");

            fireEvent.dragStart(tabs[0]!);
            fireEvent.dragOver(tabs[2]!);
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
        <SExpectedResult style={{ left: 0 }}>
          the first tab should be hidden (we never dropped it)
        </SExpectedResult>
        <SExpectedResult style={{ top: "50px" }}>tab content should be hidden</SExpectedResult>
      </PanelSetup>
    );
  },

  name: "prevent dragging selected parent tab into child tab panel",
};

export const DraggingAndDroppingANestedTabPanelDoesNotRemoveAnyTabs: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        panelCatalog={new MockPanelCatalog()}
        fixture={nestedTabLayoutFixture}
        style={{ width: "100%" }}
        onMount={() => {
          setTimeout(async () => {
            // Create a new tab on the left side
            (
              document.querySelectorAll(
                '[data-testid~="Tab!Left"] [data-testid="add-tab"]',
              )[0] as any
            ).click();

            const dragHandle = document.querySelector(
              '[data-testid~="Tab!RightInner"] [data-testid="panel-menu"]',
            );

            const target = document.querySelector(
              '[data-testid~="Tab!Left"] [data-testid="empty-drop-target"]',
            );
            dragAndDrop(dragHandle!, target!);
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
      </PanelSetup>
    );
  },

  name: "dragging and dropping a nested tab panel does not remove any tabs",
};

export const SupportsDraggingBetweenTabsAnywhereInTheLayout: StoryObj = {
  render: () => {
    return (
      <PanelSetup
        panelCatalog={new MockPanelCatalog()}
        fixture={nestedTabLayoutFixture2}
        style={{ width: "100%" }}
        onMount={() => {
          setTimeout(async () => {
            const dragHandle = document.querySelector(
              '[data-testid~="Sample1"] [data-testid="mosaic-drag-handle"]',
            );

            const target = document
              .querySelector('[data-testid="unknown!inner4"]')
              ?.parentElement?.parentElement?.parentElement?.querySelector(".drop-target.left");

            dragAndDrop(dragHandle!, target!);
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
      </PanelSetup>
    );
  },

  name: "supports dragging between tabs anywhere in the layout",
};
