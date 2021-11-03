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
import styled from "styled-components";

import Flex from "@foxglove/studio-base/components/Flex";
import Panel from "@foxglove/studio-base/components/Panel";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import { UnconnectedPanelLayout } from "@foxglove/studio-base/components/PanelLayout";
import { EmptyDropTarget } from "@foxglove/studio-base/panels/Tab/EmptyDropTarget";
import {
  DraggingTabPanelState,
  TabDndContext,
} from "@foxglove/studio-base/panels/Tab/TabDndContext";
import { TabbedToolbar } from "@foxglove/studio-base/panels/Tab/TabbedToolbar";
import { TabPanelConfig as Config } from "@foxglove/studio-base/types/layouts";
import { SaveConfig } from "@foxglove/studio-base/types/panels";
import { TAB_PANEL_TYPE } from "@foxglove/studio-base/util/globalConstants";
import { DEFAULT_TAB_PANEL_CONFIG, updateTabPanelLayout } from "@foxglove/studio-base/util/layout";

const SPanelCover = styled.div`
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  background: ${({ theme }) => theme.semanticColors.bodyBackground};
  position: absolute;
`;

type Props = { config: Config; saveConfig: SaveConfig<Config> };

function Tab({ config, saveConfig }: Props) {
  const panelId = usePanelContext().id;

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
    <Flex col>
      <TabbedToolbar
        panelId={panelId}
        tabs={tabs}
        actions={actions}
        activeTabIdx={activeTabIdx}
        setDraggingTabState={setDraggingTabState}
      />
      <Flex
        style={{
          position: "relative",
        }}
      >
        {activeLayout != undefined ? (
          <TabDndContext.Provider value={{ preventTabDrop }}>
            <UnconnectedPanelLayout
              layout={activeLayout}
              onChange={onChangeLayout}
              tabId={panelId}
            />
          </TabDndContext.Provider>
        ) : (
          <EmptyDropTarget tabId={panelId} />
        )}
        {preventTabDrop && <SPanelCover />}
      </Flex>
    </Flex>
  );
}

Tab.panelType = TAB_PANEL_TYPE;
Tab.defaultConfig = DEFAULT_TAB_PANEL_CONFIG;
Tab.supportsStrictMode = false;

export default Panel(Tab);
