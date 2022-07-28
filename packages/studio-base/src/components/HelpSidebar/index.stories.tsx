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

import { PanelCatalog, PanelInfo } from "@foxglove/studio-base/context/PanelCatalogContext";
import HelpInfoProvider from "@foxglove/studio-base/providers/HelpInfoProvider";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import HelpSidebar from ".";

export default {
  title: "components/HelpSidebar",
  component: HelpSidebar,
};

const allPanels: readonly PanelInfo[] = [
  { title: "Some Panel", type: "Sample1", module: async () => await new Promise(() => {}) },
  {
    title: "Another Panel",
    type: "Sample2",
    module: async () => await new Promise(() => {}),
    help: <>Another Panel&apos;s help content</>,
  },
];

class MockPanelCatalog implements PanelCatalog {
  getPanels(): readonly PanelInfo[] {
    return allPanels;
  }
  getPanelByType(type: string): PanelInfo | undefined {
    return allPanels.find((panel) => !panel.config && panel.type === type);
  }
}

export function Home(): JSX.Element {
  return (
    <div style={{ margin: 30, height: 400 }}>
      <PanelSetup
        panelCatalog={new MockPanelCatalog()}
        fixture={{ topics: [], datatypes: new Map(), frame: {}, layout: "Sample2!4co6n9d" }}
        omitDragAndDrop
      >
        <HelpInfoProvider>
          <HelpSidebar />
        </HelpInfoProvider>
      </PanelSetup>
    </div>
  );
}

export function PanelView(): JSX.Element {
  return (
    <div style={{ margin: 30, height: 400 }}>
      <PanelSetup
        onMount={(el) => {
          const buttonsForPanel = el.querySelectorAll("[data-testid='Another Panel']") as any;

          for (const buttonForPanel of buttonsForPanel) {
            if (buttonForPanel != undefined) {
              buttonForPanel.click();
            }
          }
        }}
        panelCatalog={new MockPanelCatalog()}
        fixture={{ topics: [], datatypes: new Map(), frame: {}, layout: "Sample2!4co6n9d" }}
        omitDragAndDrop
      >
        <HelpInfoProvider>
          <HelpSidebar />
        </HelpInfoProvider>
      </PanelSetup>
    </div>
  );
}
