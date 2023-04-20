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

import { StoryObj } from "@storybook/react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import { PanelCatalog, PanelInfo } from "@foxglove/studio-base/context/PanelCatalogContext";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import PanelSettings from ".";

export default {
  title: "components/PanelSettings",
  component: PanelSettings,
};

const panels: readonly PanelInfo[] = [
  { title: "Sample", type: "Sample1", module: async () => await new Promise(() => {}) },
];

class MockPanelCatalog implements PanelCatalog {
  public getPanels(): readonly PanelInfo[] {
    return panels;
  }
  public getPanelByType(type: string): PanelInfo | undefined {
    return panels.find((panel) => !panel.config && panel.type === type);
  }
}

const fixture = { topics: [], datatypes: new Map(), frame: {}, layout: "Sample1!abc" };
const selectedPanelIds: readonly string[] = ["Sample1!abc"];

export const NoPanelSelected: StoryObj = {
  render: () => {
    return (
      <div style={{ margin: 30, height: 400 }}>
        <DndProvider backend={HTML5Backend}>
          <MockCurrentLayoutProvider>
            <PanelSetup panelCatalog={new MockPanelCatalog()} fixture={fixture} omitDragAndDrop>
              <PanelSettings />
            </PanelSetup>
          </MockCurrentLayoutProvider>
        </DndProvider>
      </div>
    );
  },
};

export const PanelSelected: StoryObj = {
  render: () => {
    return (
      <div style={{ margin: 30, height: 400 }}>
        <DndProvider backend={HTML5Backend}>
          <MockCurrentLayoutProvider>
            <PanelSetup
              panelCatalog={new MockPanelCatalog()}
              fixture={{ ...fixture, savedProps: { "Sample1!abc": { someKey: "someVal" } } }}
              omitDragAndDrop
            >
              <PanelSettings selectedPanelIdsForTests={selectedPanelIds} />
            </PanelSetup>
          </MockCurrentLayoutProvider>
        </DndProvider>
      </div>
    );
  },
};

export const PanelLoading: StoryObj = {
  render: () => {
    return (
      <div style={{ margin: 30, height: 400 }}>
        <DndProvider backend={HTML5Backend}>
          <MockCurrentLayoutProvider>
            <PanelSetup panelCatalog={new MockPanelCatalog()} fixture={fixture} omitDragAndDrop>
              <PanelSettings selectedPanelIdsForTests={selectedPanelIds} />
            </PanelSetup>
          </MockCurrentLayoutProvider>
        </DndProvider>
      </div>
    );
  },
};
