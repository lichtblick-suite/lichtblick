// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable storybook/story-exports */

import { StoryFn } from "@storybook/react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import MockMessagePipelineProvider from "@lichtblick/suite-base/components/MessagePipeline/MockMessagePipelineProvider";
import Panel from "@lichtblick/suite-base/components/Panel";
import PanelCatalogContext, {
  PanelCatalog,
  PanelInfo,
} from "@lichtblick/suite-base/context/PanelCatalogContext";
import MockCurrentLayoutProvider from "@lichtblick/suite-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import WorkspaceContextProvider from "@lichtblick/suite-base/providers/WorkspaceContextProvider";

const SamplePanel1 = function () {
  return <div></div>;
};
SamplePanel1.panelType = "sample";
SamplePanel1.defaultConfig = {};

const SamplePanel2 = function () {
  return <div></div>;
};
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

export default {
  title: "components/AppBar",
  excludeStories: ["StorybookDecorator"],
};

export function StorybookDecorator(Wrapped: StoryFn): React.JSX.Element {
  return (
    <DndProvider backend={HTML5Backend}>
      <WorkspaceContextProvider>
        <PanelCatalogContext.Provider value={new MockPanelCatalog()}>
          <MockCurrentLayoutProvider>
            <MockMessagePipelineProvider>
              <Wrapped />
            </MockMessagePipelineProvider>
          </MockCurrentLayoutProvider>
        </PanelCatalogContext.Provider>
      </WorkspaceContextProvider>
    </DndProvider>
  );
}
