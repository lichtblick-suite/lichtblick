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

import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { createGlobalStyle } from "styled-components";

import { HideErrorSourceLocations } from "@foxglove/studio-base/components/ErrorBoundary";
import MockPanelContextProvider from "@foxglove/studio-base/components/MockPanelContextProvider";
import Panel from "@foxglove/studio-base/components/Panel";
import { PanelCatalog, PanelInfo } from "@foxglove/studio-base/context/PanelCatalogContext";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import { PanelConfigSchemaEntry } from "@foxglove/studio-base/types/panels";

import PanelLayout from "./PanelLayout";

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

const DEFAULT_CLICK_DELAY = 100;

export default {
  title: "components/PanelLayout",
};

export const PanelNotFound = (): JSX.Element => {
  return (
    <DndProvider backend={HTML5Backend}>
      <PanelSetup
        onMount={() => {
          setTimeout(() => {
            (document.querySelectorAll("[data-test=panel-settings]")[0] as any).click();
          }, DEFAULT_CLICK_DELAY);
        }}
        fixture={{ topics: [], datatypes: new Map(), frame: {}, layout: "UnknownPanel!4co6n9d" }}
        omitDragAndDrop
      >
        <PanelLayout />
      </PanelSetup>
    </DndProvider>
  );
};
PanelNotFound.parameters = { colorScheme: "dark" };
export const PanelNotFoundLight = Object.assign(PanelNotFound.bind(undefined), {
  parameters: { colorScheme: "light" },
});

const PanelToolbarShown = createGlobalStyle`
  .panelToolbarHovered {
    display: flex !important;
  }
`;

export const PanelWithError = (): JSX.Element => {
  return (
    <DndProvider backend={HTML5Backend}>
      <HideErrorSourceLocations.Provider value={true}>
        <PanelToolbarShown />
        <PanelSetup
          panelCatalog={new MockPanelCatalog()}
          fixture={{ topics: [], datatypes: new Map(), frame: {}, layout: "Sample2!4co6n9d" }}
          omitDragAndDrop
        >
          <PanelLayout />
        </PanelSetup>
      </HideErrorSourceLocations.Provider>
    </DndProvider>
  );
};

export const RemoveUnknownPanel = (): JSX.Element => {
  return (
    <DndProvider backend={HTML5Backend}>
      <PanelSetup
        onMount={() => {
          setTimeout(() => {
            (document.querySelectorAll("[data-test=panel-settings]")[0] as any).click();
            (document.querySelectorAll("[data-test=panel-settings-remove]")[0] as any).click();
          }, DEFAULT_CLICK_DELAY);
        }}
        fixture={{ topics: [], datatypes: new Map(), frame: {}, layout: "UnknownPanel!4co6n9d" }}
        omitDragAndDrop
      >
        <MockPanelContextProvider>
          <PanelLayout />
        </MockPanelContextProvider>
      </PanelSetup>
    </DndProvider>
  );
};

export const PanelLoading = (): JSX.Element => {
  return (
    <DndProvider backend={HTML5Backend}>
      <PanelSetup
        panelCatalog={new MockPanelCatalog()}
        fixture={{ topics: [], datatypes: new Map(), frame: {}, layout: "Sample1!4co6n9d" }}
        omitDragAndDrop
      >
        <MockPanelContextProvider>
          <PanelLayout />
        </MockPanelContextProvider>
      </PanelSetup>
    </DndProvider>
  );
};
