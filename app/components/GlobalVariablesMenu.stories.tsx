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
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Provider } from "react-redux";

import createRootReducer from "@foxglove-studio/app/reducers";
import configureStore from "@foxglove-studio/app/store/configureStore.testing";

import GlobalVariablesMenu from "./GlobalVariablesMenu";

storiesOf("components/GlobalVariablesMenu", module)
  .add("closed", () => {
    return (
      <div style={{ margin: 30, paddingLeft: 300, height: 400 }}>
        <DndProvider backend={HTML5Backend}>
          <Provider store={configureStore(createRootReducer(createMemoryHistory()))}>
            <GlobalVariablesMenu />
          </Provider>
        </DndProvider>
      </div>
    );
  })
  .add("open", () => {
    return (
      <div style={{ margin: 30, paddingLeft: 300, height: 400 }}>
        <DndProvider backend={HTML5Backend}>
          <Provider store={configureStore(createRootReducer(createMemoryHistory()))}>
            <GlobalVariablesMenu defaultIsOpen />
          </Provider>
        </DndProvider>
      </div>
    );
  });
