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

import AddIcon from "@mui/icons-material/Add";
import { IconButton, styled as muiStyled, useTheme } from "@mui/material";
import { useEffect } from "react";
import { useDrop } from "react-dnd";

import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import { DraggableToolbarTab } from "@foxglove/studio-base/panels/Tab/DraggableToolbarTab";
import {
  DraggingTabItem,
  TAB_DRAG_TYPE,
  TabActions,
} from "@foxglove/studio-base/panels/Tab/TabDndContext";
import { TabConfig } from "@foxglove/studio-base/types/layouts";

const STabbedToolbar = muiStyled("div")(({ theme }) => ({
  flex: "0 0",
  display: "flex",
  position: "relative",
  flexDirection: "column",
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
  paddingLeft: theme.spacing(0.5),
}));

const STabs = muiStyled("div")({
  flex: "auto",
  display: "flex",
  alignItems: "flex-end",
});

const StyledIconButton = muiStyled(IconButton)(({ theme }) => ({
  padding: theme.spacing(0.25),
  margin: theme.spacing(0, 0.5, -0.25),
}));

type Props = {
  panelId: string;
  actions: TabActions;
  tabs: TabConfig[];
  activeTabIdx: number;
  setDraggingTabState: (arg0: { isOver: boolean; item?: DraggingTabItem }) => void;
};

export function TabbedToolbar(props: Props): JSX.Element {
  const { panelId, actions, tabs, activeTabIdx, setDraggingTabState } = props;
  const theme = useTheme();

  const [{ isOver, item }, dropRef] = useDrop({
    accept: TAB_DRAG_TYPE,
    collect: (monitor) => ({
      item: monitor.getItem(),
      isOver: monitor.isOver(),
    }),
  });
  useEffect(() => {
    setDraggingTabState({ item, isOver });
  }, [item, isOver, setDraggingTabState]);

  return (
    <STabbedToolbar>
      <PanelToolbar backgroundColor={theme.palette.background.default}>
        <STabs role="tab" ref={dropRef} data-testid="toolbar-droppable">
          {tabs.map((tab, i) => (
            <DraggableToolbarTab
              isActive={activeTabIdx === i}
              key={i}
              panelId={panelId}
              actions={actions}
              tabCount={tabs.length}
              tabIndex={i}
              tabTitle={tab.title}
            />
          ))}
          <StyledIconButton
            size="small"
            data-testid="add-tab"
            title="Add tab"
            onClick={actions.addTab}
          >
            <AddIcon fontSize="inherit" />
          </StyledIconButton>
        </STabs>
      </PanelToolbar>
    </STabbedToolbar>
  );
}
