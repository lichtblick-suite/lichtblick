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

import { StoryFn, StoryObj } from "@storybook/react";
import { fireEvent, screen } from "@storybook/testing-library";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import LayoutStorageContext from "@foxglove/studio-base/context/LayoutStorageContext";
import { PanelCatalog, PanelInfo } from "@foxglove/studio-base/context/PanelCatalogContext";
import LayoutManagerProvider from "@foxglove/studio-base/providers/LayoutManagerProvider";
import LayoutManager from "@foxglove/studio-base/services/LayoutManager/LayoutManager";
import MockLayoutStorage from "@foxglove/studio-base/services/MockLayoutStorage";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import PanelLayout from "./PanelLayout";

async function openPanelMenu(): Promise<void> {
  const buttons = await screen.findAllByTestId("panel-menu");
  fireEvent.click(buttons[0]!);
}

async function goFullScreen(): Promise<void> {
  await openPanelMenu();
  fireEvent.click(screen.getAllByTestId("panel-menu-fullscreen")[0]!);
}

const allPanels: readonly PanelInfo[] = [
  { title: "Some Panel", type: "Sample1", module: async () => await new Promise(() => {}) },
  {
    title: "Broken Panel",
    type: "Sample2",
    module: async () => {
      return {
        default: Panel(
          Object.assign(
            function BrokenPanel() {
              throw new Error("I don't work!");
            },
            { panelType: "Sample2", defaultConfig: {} },
          ),
        ),
      };
    },
  },
  {
    title: "Okay Panel",
    type: "Sample3",
    module: async () => {
      return {
        default: Panel(
          Object.assign(
            function OkayPanel({ config: { x } }: { config: { x: number } }) {
              return (
                <>
                  <PanelToolbar />
                  Hi {x}
                </>
              );
            },
            { panelType: "Sample3", defaultConfig: { x: 0 } },
          ),
        ),
      };
    },
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

export default {
  title: "components/PanelLayout",
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

export const PanelNotFound: StoryObj = {
  render: function Story() {
    return (
      <DndProvider backend={HTML5Backend}>
        <PanelSetup
          fixture={{ topics: [], datatypes: new Map(), frame: {}, layout: "UnknownPanel!4co6n9d" }}
          omitDragAndDrop
        >
          <PanelLayout />
        </PanelSetup>
      </DndProvider>
    );
  },

  parameters: { colorScheme: "dark" },
  play: openPanelMenu,
};

export const PanelNotFoundLight: StoryObj = {
  ...PanelNotFound,
  parameters: { colorScheme: "light" },
  play: openPanelMenu,
};

export const PanelWithError: StoryObj = {
  render: () => {
    return (
      <DndProvider backend={HTML5Backend}>
        <PanelSetup
          panelCatalog={new MockPanelCatalog()}
          fixture={{ topics: [], datatypes: new Map(), frame: {}, layout: "Sample2!4co6n9d" }}
          omitDragAndDrop
        >
          <PanelLayout />
        </PanelSetup>
      </DndProvider>
    );
  },
};

export const RemoveUnknownPanel: StoryObj = {
  render: function Story() {
    return (
      <DndProvider backend={HTML5Backend}>
        <PanelSetup
          fixture={{ topics: [], datatypes: new Map(), frame: {}, layout: "UnknownPanel!4co6n9d" }}
          omitDragAndDrop
        >
          <PanelLayout />
        </PanelSetup>
      </DndProvider>
    );
  },

  play: async () => {
    (await screen.findAllByTestId("panel-menu")).forEach((button) => fireEvent.click(button));
    (await screen.findAllByTestId("panel-menu-remove")).forEach((button) =>
      fireEvent.click(button),
    );
  },
};

export const EmptyLayout: StoryObj = {
  render: () => {
    return (
      <PanelSetup fixture={{ layout: undefined }}>
        <PanelLayout />
      </PanelSetup>
    );
  },
};

export const EmptyLayoutChinese: StoryObj = {
  ...EmptyLayout,
  parameters: { forceLanguage: "zh" },
};
export const EmptyLayoutJapanese: StoryObj = {
  ...EmptyLayout,
  parameters: { forceLanguage: "ja" },
};

export const PanelLoading: StoryObj = {
  render: () => {
    return (
      <DndProvider backend={HTML5Backend}>
        <PanelSetup
          panelCatalog={new MockPanelCatalog()}
          fixture={{ topics: [], datatypes: new Map(), frame: {}, layout: "Sample1!4co6n9d" }}
          omitDragAndDrop
        >
          <PanelLayout />
        </PanelSetup>
      </DndProvider>
    );
  },
};

export const FullScreen: StoryObj = {
  render: function Story() {
    return (
      <DndProvider backend={HTML5Backend}>
        <PanelSetup
          panelCatalog={new MockPanelCatalog()}
          fixture={{
            topics: [],
            datatypes: new Map(),
            frame: {},
            layout: { first: "Sample3!a", second: "Sample3!b", direction: "row" },
            savedProps: {
              "Sample3!a": { x: 1 },
              "Sample3!b": { x: 2 },
            },
          }}
          omitDragAndDrop
        >
          <PanelLayout />
        </PanelSetup>
      </DndProvider>
    );
  },

  parameters: { colorScheme: "dark" },
  play: goFullScreen,
};

export const FullScreenLight: StoryObj = {
  ...FullScreen,
  parameters: { colorScheme: "light" },
  play: goFullScreen,
};
