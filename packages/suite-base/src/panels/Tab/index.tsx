// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import { useCallback, useMemo, useState } from "react";
import { MosaicNode } from "react-mosaic-component";
import { makeStyles } from "tss-react/mui";

import { EmptyPanelLayout } from "@lichtblick/suite-base/components/EmptyPanelLayout";
import Panel from "@lichtblick/suite-base/components/Panel";
import { usePanelContext } from "@lichtblick/suite-base/components/PanelContext";
import { UnconnectedPanelLayout } from "@lichtblick/suite-base/components/PanelLayout";
import Stack from "@lichtblick/suite-base/components/Stack";
import {
  DraggingTabPanelState,
  TabDndContext,
} from "@lichtblick/suite-base/panels/Tab/TabDndContext";
import { TabbedToolbar } from "@lichtblick/suite-base/panels/Tab/TabbedToolbar";
import { TabPanelConfig as Config } from "@lichtblick/suite-base/types/layouts";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";
import { TAB_PANEL_TYPE } from "@lichtblick/suite-base/util/constants";
import { DEFAULT_TAB_PANEL_CONFIG, updateTabPanelLayout } from "@lichtblick/suite-base/util/layout";

const useStyles = makeStyles()((theme) => ({
  panelCover: {
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: 1,
    background: theme.palette.background.paper,
    position: "absolute",
  },
}));

type Props = { config: Config; saveConfig: SaveConfig<Config> };

function Tab({ config, saveConfig }: Props) {
  const panelId = usePanelContext().id;
  const { classes } = useStyles();

  const { tabs, activeTabIdx } = config;
  const activeTab = tabs[activeTabIdx];
  const activeLayout = activeTab?.layout;

  // Holds the state of actively dragging tabs as they relate to this Tab Panel
  const [draggingTabState, setDraggingTabState] = useState<DraggingTabPanelState>({
    item: undefined,
    isOver: false,
  });

  // Create the actions used by the tab
  const selectTab = useCallback(
    (idx: number) => {
      saveConfig({ activeTabIdx: idx });
    },
    [saveConfig],
  );
  const setTabTitle = useCallback(
    (idx: number, title: string) => {
      const newTabs = tabs.slice();
      newTabs[idx] = { ...tabs[idx], title };
      saveConfig({ tabs: newTabs });
    },
    [saveConfig, tabs],
  );
  const removeTab = useCallback(
    (idx: number) => {
      const newTabs = tabs.slice(0, idx).concat(tabs.slice(idx + 1));
      const lastIdx = tabs.length - 1;
      saveConfig({
        tabs: newTabs,
        activeTabIdx: activeTabIdx === lastIdx ? lastIdx - 1 : activeTabIdx,
      });
    },
    [activeTabIdx, saveConfig, tabs],
  );
  const addTab = useCallback(() => {
    const newTab = { title: `${tabs.length + 1}`, layout: undefined };
    saveConfig({ ...config, activeTabIdx: tabs.length, tabs: tabs.concat([newTab]) });
  }, [config, saveConfig, tabs]);
  const onChangeLayout = useCallback(
    (layout: MosaicNode<string> | undefined) => {
      saveConfig(updateTabPanelLayout(layout, config));
    },
    [config, saveConfig],
  );
  const actions = useMemo(
    () => ({ addTab, removeTab, selectTab, setTabTitle }),
    [addTab, removeTab, selectTab, setTabTitle],
  );

  // If the user drags the active tab out of the toolbar, we'll hide the
  // active layout in order to prevent tabs from dropping into child tabs.
  const draggingTab = draggingTabState.item;
  const preventTabDrop =
    !!draggingTab &&
    draggingTab.panelId === panelId &&
    draggingTab.tabIndex === activeTabIdx &&
    !draggingTabState.isOver;

  return (
    <Stack flex="auto" overflow="hidden">
      <TabbedToolbar
        panelId={panelId}
        tabs={tabs}
        actions={actions}
        activeTabIdx={activeTabIdx}
        setDraggingTabState={setDraggingTabState}
      />
      <Stack direction="row" flex="auto" overflow="hidden" position="relative">
        {activeLayout != undefined ? (
          <TabDndContext.Provider value={{ preventTabDrop }}>
            <UnconnectedPanelLayout
              layout={activeLayout}
              onChange={onChangeLayout}
              tabId={panelId}
            />
          </TabDndContext.Provider>
        ) : (
          <EmptyPanelLayout tabId={panelId} />
        )}
        {preventTabDrop && <div className={classes.panelCover} />}
      </Stack>
    </Stack>
  );
}

Tab.panelType = TAB_PANEL_TYPE;
Tab.defaultConfig = DEFAULT_TAB_PANEL_CONFIG;

export default Panel(Tab);
