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

import * as _ from "lodash-es";

import { TabPanelConfig } from "@foxglove/studio-base/types/layouts";
import { SavedProps } from "@foxglove/studio-base/types/panels";
import {
  getAllPanelIds,
  getParentTabPanelByPanelId,
  isTabPanel,
} from "@foxglove/studio-base/util/layout";

export default function toggleSelectedPanel(
  panelId: string,
  containingTabId: string | undefined,
  configById: SavedProps,
  selectedPanelIds: readonly string[],
): string[] {
  const panelIdsToDeselect = [];

  // If we selected a Tab panel, deselect its children
  const savedConfig = configById[panelId];
  if (isTabPanel(panelId) && savedConfig) {
    const { activeTabIdx, tabs } = savedConfig as TabPanelConfig;
    const activeTabLayout = tabs[activeTabIdx]?.layout;
    if (activeTabLayout != undefined) {
      const childrenPanelIds = getAllPanelIds(activeTabLayout, configById);
      panelIdsToDeselect.push(...childrenPanelIds);
    }
  }

  // If we selected a child, deselect all parent Tab panels
  const parentTabPanelByPanelId = getParentTabPanelByPanelId(configById);
  let nextParentId = containingTabId;
  const parentTabPanelIds = [];
  while (nextParentId != undefined) {
    parentTabPanelIds.push(nextParentId);
    nextParentId = parentTabPanelByPanelId[nextParentId];
  }
  panelIdsToDeselect.push(...parentTabPanelIds);

  const nextSelectedPanelIds = _.xor(selectedPanelIds, [panelId]);
  const nextValidSelectedPanelIds = _.without(nextSelectedPanelIds, ...panelIdsToDeselect);
  return nextValidSelectedPanelIds;
}
