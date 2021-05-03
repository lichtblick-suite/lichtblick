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

import { storiesOf } from "@storybook/react";
import { createMemoryHistory } from "history";
import { useMemo } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Provider } from "react-redux";

import AddPanelMenu from "@foxglove-studio/app/components/AddPanelMenu";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelCatalogContext, {
  PanelCatalog,
  PanelCategory,
  PanelInfo,
} from "@foxglove-studio/app/context/PanelCatalogContext";
import createRootReducer from "@foxglove-studio/app/reducers";
import configureStore from "@foxglove-studio/app/store/configureStore.testing";

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

class MockPanelCatalog implements PanelCatalog {
  getPanelCategories(): PanelCategory[] {
    return [
      { label: "ROS", key: "ros" },
      { label: "DEBUG", key: "debug" },
    ];
  }
  getPanelsByCategory(): Map<string, PanelInfo[]> {
    return new Map([
      ["ros", [{ title: "A Panel", component: MockPanel1 }]],
      ["debug", [{ title: "B Panel", component: MockPanel2 }]],
    ]);
  }
  getPanelsByType(): Map<string, PanelInfo> {
    return new Map();
  }
  getComponentForType(_type: string): PanelInfo["component"] | undefined {
    return undefined;
  }
}

storiesOf("components/AddPanelMenu", module)
  .addParameters({
    chromatic: {
      delay: 500,
    },
  })
  .add("standard", () => {
    const mockPanelCatalog = useMemo(() => new MockPanelCatalog(), []);
    return (
      <div style={{ margin: 30, paddingLeft: 300, height: 400 }}>
        <DndProvider backend={HTML5Backend}>
          <Provider store={configureStore(createRootReducer(createMemoryHistory()))}>
            <PanelCatalogContext.Provider value={mockPanelCatalog}>
              <AddPanelMenu defaultIsOpen />
            </PanelCatalogContext.Provider>
          </Provider>
        </DndProvider>
      </div>
    );
  });
