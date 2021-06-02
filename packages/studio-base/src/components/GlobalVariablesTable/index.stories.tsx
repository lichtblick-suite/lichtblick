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

import { useMemo } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

import CurrentLayoutContext from "@foxglove/studio-base/context/CurrentLayoutContext";
import CurrentLayoutState, {
  DEFAULT_LAYOUT_FOR_TESTS,
} from "@foxglove/studio-base/providers/CurrentLayoutProvider/CurrentLayoutState";

import GlobalVariablesTable from ".";

export default {
  title: "components/GlobalVariablesTable",
  component: GlobalVariablesTable,
};

export function Table(): JSX.Element {
  const currentLayout = useMemo(() => new CurrentLayoutState(DEFAULT_LAYOUT_FOR_TESTS), []);
  return (
    <div style={{ margin: 30, paddingLeft: 300, height: 400 }}>
      <DndProvider backend={HTML5Backend}>
        <CurrentLayoutContext.Provider value={currentLayout}>
          <GlobalVariablesTable />
        </CurrentLayoutContext.Provider>
      </DndProvider>
    </div>
  );
}
