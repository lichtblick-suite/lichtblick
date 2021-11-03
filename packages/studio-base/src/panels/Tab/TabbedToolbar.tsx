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

import PlusIcon from "@mdi/svg/svg/plus.svg";
import { useContext, useEffect } from "react";
import { DropTargetMonitor, useDrop } from "react-dnd";
import styled from "styled-components";

import Icon from "@foxglove/studio-base/components/Icon";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import { useCurrentLayoutActions } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { DraggableToolbarTab } from "@foxglove/studio-base/panels/Tab/DraggableToolbarTab";
import {
  DraggingTabItem,
  TAB_DRAG_TYPE,
  TabActions,
  TabDndContext,
} from "@foxglove/studio-base/panels/Tab/TabDndContext";
import helpContent from "@foxglove/studio-base/panels/Tab/index.help.md";
import { TabConfig } from "@foxglove/studio-base/types/layouts";

const STabbedToolbar = styled.div<{ highlight: boolean }>`
  flex: 0 0;
  display: flex;
  position: relative;
  flex-direction: column;

  &:after {
    border: 2px solid
      ${({ highlight, theme }) =>
        highlight ? theme.semanticColors.listItemBackgroundChecked : "transparent"};
    content: "";
    height: 100%;
    left: 0;
    pointer-events: none;
    position: absolute;
    top: 0;
    width: 100%;
    z-index: 1;
  }
`;
const STabs = styled.div`
  flex: 1 1;
  display: flex;
  align-items: flex-end;
`;

type Props = {
  panelId: string;
  actions: TabActions;
  tabs: TabConfig[];
  activeTabIdx: number;
  setDraggingTabState: (arg0: { isOver: boolean; item?: DraggingTabItem }) => void;
};

export function TabbedToolbar(props: Props): JSX.Element {
  const { panelId, actions, tabs, activeTabIdx, setDraggingTabState } = props;
  const { moveTab } = useCurrentLayoutActions();

  const { preventTabDrop } = useContext(TabDndContext);
  const [{ isOver, item }, dropRef] = useDrop({
    accept: TAB_DRAG_TYPE,
    collect: (monitor) => ({
      item: monitor.getItem(),
      isOver: monitor.isOver(),
    }),
    canDrop: () => !preventTabDrop,
    drop: (sourceItem: DraggingTabItem, monitor: DropTargetMonitor) => {
      // Drop was already handled by DraggableToolTab, ignore here
      if (monitor.didDrop()) {
        return;
      }
      const source = {
        panelId: sourceItem.panelId,
        tabIndex: sourceItem.tabIndex,
      };
      const target = { panelId };
      moveTab({ source, target });
    },
  });
  useEffect(() => {
    setDraggingTabState({ item, isOver });
  }, [item, isOver, setDraggingTabState]);

  return (
    <STabbedToolbar highlight={isOver}>
      <PanelToolbar helpContent={helpContent}>
        <STabs ref={dropRef} data-test="toolbar-droppable">
          {tabs.map((tab, i) => (
            <DraggableToolbarTab
              isActive={activeTabIdx === i}
              key={i}
              panelId={panelId}
              setDraggingTabState={setDraggingTabState}
              actions={actions}
              tabCount={tabs.length}
              tabIndex={i}
              tabTitle={tab.title}
            />
          ))}
          <Icon
            size="small"
            fade
            dataTest="add-tab"
            tooltip="Add tab"
            style={{
              flexShrink: 0,
              margin: "0 8px",
              transition: "opacity 0.2s",
            }}
            onClick={actions.addTab}
          >
            <PlusIcon onMouseDown={(e) => e.preventDefault()} />
          </Icon>
        </STabs>
      </PanelToolbar>
    </STabbedToolbar>
  );
}
