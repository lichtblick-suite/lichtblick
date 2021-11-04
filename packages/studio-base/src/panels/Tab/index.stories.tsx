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
import TestUtils from "react-dom/test-utils";

import Panel from "@foxglove/studio-base/components/Panel";
import PanelLayout from "@foxglove/studio-base/components/PanelLayout";
import { PanelCatalog, PanelInfo } from "@foxglove/studio-base/context/PanelCatalogContext";
import {
  nestedTabLayoutFixture,
  nestedTabLayoutFixture2,
} from "@foxglove/studio-base/panels/Tab/nestedTabLayoutFixture";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import { SExpectedResult } from "@foxglove/studio-base/stories/storyHelpers";
import { dragAndDrop } from "@foxglove/studio-base/test/dragAndDropHelper";
import { PanelConfigSchemaEntry } from "@foxglove/studio-base/types/panels";
import tick from "@foxglove/studio-base/util/tick";

import Tab from "./index";

const SamplePanel1 = function () {
  return <div>Sample Panel 1</div>;
};
SamplePanel1.panelType = "Sample1";
SamplePanel1.defaultConfig = {};

const SamplePanel2 = function () {
  return <div>Sample Panel 2</div>;
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

class MockPanelCatalog implements PanelCatalog {
  async getConfigSchema(type: string): Promise<PanelConfigSchemaEntry<string>[] | undefined> {
    const info = this.getPanelByType(type);
    if (!info) {
      return undefined;
    }
    const module = await info?.module();
    return module.default.configSchema;
  }
  getPanels(): readonly PanelInfo[] {
    return allPanels;
  }
  getPanelByType(type: string): PanelInfo | undefined {
    return allPanels.find((panel) => panel.preconfigured !== true && panel.type === type);
  }
}

const fixture = { topics: [], datatypes: new Map(), frame: {}, layout: "Tab!a" };
const manyTabs = new Array(25)
  .fill(1)
  .map((_elem, idx) => ({ title: `Tab #${idx + 1}`, layout: undefined }));
const DEFAULT_TIMEOUT = 200;
storiesOf("panels/Tab", module)
  .addParameters({
    chromatic: {
      delay: 1000,
    },
    colorScheme: "dark",
  })
  .add(
    "default",
    () => (
      <PanelSetup fixture={fixture}>
        <Tab />
      </PanelSetup>
    ),
    { colorScheme: "both-row" },
  )
  .add("showing panel list", () => (
    <PanelSetup
      fixture={fixture}
      panelCatalog={new MockPanelCatalog()}
      onMount={() => {
        setTimeout(async () => {
          await tick();
          (document.querySelectorAll('[data-test="pick-a-panel"]')[0] as any).click();
        }, DEFAULT_TIMEOUT);
      }}
    >
      <Tab />
    </PanelSetup>
  ))
  .add(
    "showing panel list light",
    () => (
      <PanelSetup
        fixture={fixture}
        panelCatalog={new MockPanelCatalog()}
        onMount={() => {
          setTimeout(async () => {
            await tick();
            (document.querySelectorAll('[data-test="pick-a-panel"]')[0] as any).click();
          }, DEFAULT_TIMEOUT);
        }}
      >
        <Tab />
      </PanelSetup>
    ),
    { colorScheme: "light" },
  )
  .add("picking a panel from the panel list creates a new tab if there are none", () => {
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
            (document.querySelectorAll('[data-test="pick-a-panel"]')[0] as any).click();
            await tick();
            (
              document.querySelectorAll('[data-test="panel-menu-item Some Panel"]')[0] as any
            ).click();
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
      </PanelSetup>
    );
  })
  .add("picking a panel from the panel list updates the tab's layout", () => {
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
            (document.querySelectorAll('[data-test="pick-a-panel"]')[0] as any).click();
            await tick();
            (
              document.querySelectorAll('[data-test="panel-menu-item Some Panel"]')[0] as any
            ).click();
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
      </PanelSetup>
    );
  })
  .add("dragging a panel from the panel list updates the tab's layout", () => {
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
            (document.querySelectorAll('[data-test="pick-a-panel"]')[0] as any).click();
            await tick();

            const imageItem = document.querySelectorAll(
              '[data-test="panel-menu-item Some Panel"]',
            )[0];
            const panel = document.querySelectorAll('[data-test="empty-drop-target"]')[0];
            await dragAndDrop(imageItem, panel);
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
      </PanelSetup>
    );
  })
  .add("dragging a panel from the panel list creates a new tab if there are none", () => {
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
            (document.querySelectorAll('[data-test="pick-a-panel"]')[0] as any).click();
            await tick();

            const imageItem = document.querySelectorAll(
              '[data-test="panel-menu-item Some Panel"]',
            )[0];
            const panel = document.querySelectorAll('[data-test="empty-drop-target"]')[0];
            await dragAndDrop(imageItem, panel);
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
      </PanelSetup>
    );
  })
  .add(
    "with chosen active tab",
    () => (
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
    { colorScheme: "both-row" },
  )
  .add("add tab", () => {
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
            const addTabBtn = document.querySelector("[data-test=add-tab]");
            if (addTabBtn) {
              (addTabBtn as any).click();
            }
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
      </PanelSetup>
    );
  })
  .add("remove tab", () => {
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
            const removeTabBtn = document.querySelector("[data-test=tab-icon]");
            if (removeTabBtn) {
              (removeTabBtn as any).click();
            }
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
      </PanelSetup>
    );
  })
  .add("reorder tabs within Tab panel by dropping on tab", () => {
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
            await dragAndDrop(tabs[0], tabs[2]);
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
        <SExpectedResult>Expected result: #2, #3, #1, #4, #5</SExpectedResult>
      </PanelSetup>
    );
  })
  .add("reorder tabs within Tab panel by dropping on toolbar", () => {
    return (
      <PanelSetup
        panelCatalog={new MockPanelCatalog()}
        fixture={{
          ...fixture,
          savedProps: {
            "Tab!a": { activeTabIdx: 0, tabs: manyTabs.slice(0, 2) },
          },
        }}
        style={{ width: "100%" }}
        onMount={() => {
          setTimeout(async () => {
            await tick();
            const tabs = document.querySelectorAll("[draggable=true]");
            const toolbar = document.querySelectorAll('[data-test="toolbar-droppable"]')[0];

            // Drag and drop the first tab onto the toolbar
            await dragAndDrop(tabs[0], toolbar);
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
        <SExpectedResult>Expected result: #2, #1 (selected)</SExpectedResult>
      </PanelSetup>
    );
  })
  .add("move tab to different Tab panel", () => {
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
            const tabs = document.querySelectorAll("[draggable=true]");
            const toolbar = document.querySelectorAll('[data-test="toolbar-droppable"]')[1];

            // Drag and drop the first tab onto the toolbar of the second tab panel
            await dragAndDrop(tabs[1], toolbar);
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
        <SExpectedResult css="left: 0">Should have only #2</SExpectedResult>
        <SExpectedResult css="left: 50%">Should have #3 and #1</SExpectedResult>
      </PanelSetup>
    );
  })
  .add("prevent dragging selected parent tab into child tab panel", () => {
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
            const toolbar = document.querySelectorAll('[data-test="toolbar-droppable"]')[0];

            // Drag the first tab in the parent tab panel over the second tab in the child tab panel
            tabs[0]?.dispatchEvent(new MouseEvent("dragstart", { bubbles: true }));
            tabs[0]?.dispatchEvent(new MouseEvent("dragenter", { bubbles: true }));
            toolbar?.dispatchEvent(new MouseEvent("dragout", { bubbles: true }));
            await tick();
            tabs[2]?.dispatchEvent(new MouseEvent("dragover", { bubbles: true }));
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
        <SExpectedResult css="left: 0">
          the first tab should be hidden (we never dropped it)
        </SExpectedResult>
        <SExpectedResult css="top: 50px">tab content should be hidden</SExpectedResult>
      </PanelSetup>
    );
  })
  .add("dragging and dropping a nested tab panel does not remove any tabs", () => {
    return (
      <PanelSetup
        panelCatalog={new MockPanelCatalog()}
        fixture={nestedTabLayoutFixture}
        style={{ width: "100%" }}
        onMount={() => {
          setTimeout(async () => {
            // Create a new tab on the left side
            (
              document.querySelectorAll('[data-test~="Tab!Left"] [data-test="add-tab"]')[0] as any
            ).click();

            const dragHandle =
              document.querySelector(
                '[data-test~="Tab!RightInner"] [data-test="mosaic-drag-handle"]',
              ) ?? undefined;
            await dragAndDrop(
              dragHandle,
              () =>
                document.querySelector('[data-test~="Tab!Left"] [data-test="empty-drop-target"]') ??
                undefined,
            );
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
      </PanelSetup>
    );
  })
  .add("supports dragging between tabs anywhere in the layout", () => {
    return (
      <PanelSetup
        panelCatalog={new MockPanelCatalog()}
        fixture={nestedTabLayoutFixture2}
        style={{ width: "100%" }}
        onMount={() => {
          setTimeout(async () => {
            const mouseEnterContainer = document.querySelectorAll('[data-test~="Plot!1"]')[0];
            if (!mouseEnterContainer) {
              throw new Error("missing plot panel");
            }
            TestUtils.Simulate.mouseEnter(mouseEnterContainer);
            const dragHandle = document.querySelector(
              '[data-test~="Plot!1"] [data-test="mosaic-drag-handle"]',
            );
            if (!dragHandle) {
              throw new Error("missing drag handle");
            }
            await dragAndDrop(dragHandle, () => {
              const dropTarget = document
                .querySelector('[data-test~="unknown!inner4"]')
                ?.parentElement?.parentElement?.querySelector(".drop-target.left");
              if (!dropTarget) {
                throw new Error("missing drop target");
              }
              return dropTarget;
            });
          }, DEFAULT_TIMEOUT);
        }}
      >
        <PanelLayout />
      </PanelSetup>
    );
  });
