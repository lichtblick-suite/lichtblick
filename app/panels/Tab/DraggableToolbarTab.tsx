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
import React, { useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
import { useDispatch } from "react-redux";

import { moveTab, MoveTabPayload } from "@foxglove-studio/app/actions/panels";
import {
  DraggingTabItem,
  TAB_DRAG_TYPE,
  TabActions,
} from "@foxglove-studio/app/panels/Tab/TabDndContext";
import { ToolbarTab } from "@foxglove-studio/app/panels/Tab/ToolbarTab";

type Props = {
  isActive: boolean;
  panelId: string;
  actions: TabActions;
  tabCount: number;
  tabIndex: number;
  tabTitle: string;
  setDraggingTabState: (arg0: { isOver: boolean; item?: DraggingTabItem }) => void;
};

export function DraggableToolbarTab(props: Props) {
  const { isActive, tabCount, actions, panelId, tabTitle, tabIndex } = props;

  const ref = useRef(null);
  const dispatch = useDispatch();
  const [{ isDragging }, dragRef] = useDrag({
    item: { type: TAB_DRAG_TYPE, panelId, tabIndex },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, dropRef] = useDrop({
    accept: TAB_DRAG_TYPE,
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
    drop: (sourceItem, _monitor: any) => {
      const source = {
        panelId: (sourceItem as any).panelId,
        tabIndex: (sourceItem as any).tabIndex,
      };
      const target = { tabIndex, panelId };
      dispatch(moveTab({ source, target } as MoveTabPayload));
    },
  });

  dragRef(dropRef(ref)); // Combine drag and drop refs

  const tabProps = {
    tabTitle,
    tabIndex,
    isActive,
    tabCount,
    actions,
    isDragging,
    innerRef: ref,
    hidden: isDragging,
    highlight: isOver,
  };
  return <ToolbarTab {...tabProps} />;
}
