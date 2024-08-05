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
import { createContext } from "react";

export const TAB_DRAG_TYPE = "TAB";
export type DraggingTabItem = { type: typeof TAB_DRAG_TYPE; tabIndex: number; panelId: string };
export type DraggingTabPanelState = {
  item?: DraggingTabItem;
  isOver: boolean;
};

export type TabActions = {
  addTab: () => void;
  removeTab: (tabIndex: number) => void;
  selectTab: (tabIndex: number) => void;
  setTabTitle: (tabIndex: number, title: string) => void;
};

// It allows nested TabPanels to know if their parent tab is being dragged.
// This allows us to prevent situations where the parent tab is dragged into a child tab.
export const TabDndContext = createContext<{
  preventTabDrop: boolean;
}>({ preventTabDrop: false });
TabDndContext.displayName = "TabDndContext";
