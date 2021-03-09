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
import * as React from "react";
import { DndProvider } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import TestUtils from "react-dom/test-utils";
import { Provider } from "react-redux";

import PanelList from "@foxglove-studio/app/panels/PanelList";
import createRootReducer from "@foxglove-studio/app/reducers";
import configureStore from "@foxglove-studio/app/store/configureStore.testing";

const PanelListWithInteractions = ({
  inputValue,
  events = [],
}: {
  inputValue?: string;
  events?: any[];
}) => (
  <div
    style={{ margin: 50, height: 480 }}
    ref={(el) => {
      if (el) {
        const input: HTMLInputElement | null | undefined = el.querySelector("input") as any;
        if (input) {
          input.focus();
          if (inputValue) {
            input.value = inputValue;
            TestUtils.Simulate.change(input);
          }
          setTimeout(() => {
            events.forEach((event) => {
              TestUtils.Simulate.keyDown(input, event);
            });
          }, 100);
        }
      }
    }}
  >
    <PanelList
      onPanelSelect={() => {
        // no-op
      }}
    />
  </div>
);

const arrowDown = { key: "ArrowDown", code: "ArrowDown", keyCode: 40 };
const arrowUp = { key: "ArrowUp", code: "ArrowUp", keyCode: 91 };

storiesOf("<PanelList>", module)
  .addParameters({
    screenshot: {
      // Wait for simulated key events
      delay: 100,
    },
  })
  .addDecorator((childrenRenderFcn) => (
    <DndProvider backend={HTML5Backend}>
      <Provider store={configureStore(createRootReducer(createMemoryHistory()))}>
        {childrenRenderFcn()}
      </Provider>
    </DndProvider>
  ))
  .add("panel list", () => (
    <div style={{ margin: 50, height: 480 }}>
      <PanelList
        onPanelSelect={() => {
          // no-op
        }}
      />
    </div>
  ))
  .add("filtered panel list", () => <PanelListWithInteractions inputValue="h" />)
  .add("navigating panel list with arrow keys", () => (
    <PanelListWithInteractions events={[arrowDown, arrowDown, arrowUp]} />
  ))
  .add("navigating up from top of panel list will scroll to highlighted last item", () => (
    <PanelListWithInteractions events={[arrowUp]} />
  ))
  .add("filtered panel list without results in 1st category", () => (
    <PanelListWithInteractions inputValue="global" />
  ))
  .add("filtered panel list without results in last category", () => (
    <PanelListWithInteractions inputValue="tab" />
  ))
  .add("filtered panel list without results in any category", () => (
    <PanelListWithInteractions inputValue="zz" />
  ))
  .add("case-insensitive filtering and highlight submenu", () => (
    <PanelListWithInteractions inputValue="dp" />
  ));
