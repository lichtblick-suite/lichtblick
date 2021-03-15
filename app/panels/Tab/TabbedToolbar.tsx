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
import { useDispatch } from "react-redux";
import styled from "styled-components";

import { moveTab, MoveTabPayload } from "@foxglove-studio/app/actions/panels";
import Icon from "@foxglove-studio/app/components/Icon";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import { DraggableToolbarTab } from "@foxglove-studio/app/panels/Tab/DraggableToolbarTab";
import {
  DraggingTabItem,
  TAB_DRAG_TYPE,
  TabActions,
  TabDndContext,
} from "@foxglove-studio/app/panels/Tab/TabDndContext";
import helpContent from "@foxglove-studio/app/panels/Tab/index.help.md";
import { TabConfig } from "@foxglove-studio/app/types/layouts";
import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";

const STabbedToolbar = styled.div<{ highlight: boolean }>`
  flex: 0 0;
  display: flex;
  position: relative;
  flex-direction: column;

  &:after {
    border: 2px solid ${({ highlight }) => (highlight ? colors.DARK5 : "transparent")};
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

export function TabbedToolbar(props: Props) {
  const { panelId, actions, tabs, activeTabIdx, setDraggingTabState } = props;

  const dispatch = useDispatch();
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
      dispatch(moveTab({ source, target } as MoveTabPayload));
    },
  });
  useEffect(() => {
    setDraggingTabState({ item, isOver });
  }, [item, isOver, setDraggingTabState]);

  return (
    <STabbedToolbar highlight={isOver}>
      <PanelToolbar helpContent={helpContent} showHiddenControlsOnHover>
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
            small
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
