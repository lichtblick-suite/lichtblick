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
import { ButtonBase, useTheme } from "@mui/material";
import { useEffect } from "react";
import { DropTargetMonitor, useDrop } from "react-dnd";
import { makeStyles } from "tss-react/mui";

import PanelToolbar, {
  PANEL_TOOLBAR_MIN_HEIGHT,
} from "@foxglove/studio-base/components/PanelToolbar";
import ToolbarIconButton from "@foxglove/studio-base/components/PanelToolbar/ToolbarIconButton";
import Stack from "@foxglove/studio-base/components/Stack";
import { DraggableToolbarTab } from "@foxglove/studio-base/panels/Tab/DraggableToolbarTab";
import {
  DraggingTabItem,
  TAB_DRAG_TYPE,
  TabActions,
} from "@foxglove/studio-base/panels/Tab/TabDndContext";
import { TabConfig } from "@foxglove/studio-base/types/layouts";

const useStyles = makeStyles()((theme) => ({
  root: {
    backgroundColor: theme.palette.background.default,
  },
  toolbar: {
    padding: theme.spacing(0, 0.75, 0, 0.25),
  },
  button: {
    flexGrow: 1,
    height: PANEL_TOOLBAR_MIN_HEIGHT,
  },
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
  const { classes } = useStyles();
  const theme = useTheme();

  const [{ isOver, item }, dropRef] = useDrop({
    accept: TAB_DRAG_TYPE,
    collect: (monitor: DropTargetMonitor<DraggingTabItem>) => ({
      item: monitor.getItem(),
      isOver: monitor.isOver(),
    }),
  });
  useEffect(() => {
    setDraggingTabState({ item, isOver });
  }, [item, isOver, setDraggingTabState]);

  return (
    <Stack className={classes.root} flex="0 0" position="relative">
      <PanelToolbar
        className={classes.toolbar}
        backgroundColor={theme.palette.background.default}
        additionalIcons={
          <ToolbarIconButton data-testid="add-tab" title="Add tab" onClick={actions.addTab}>
            <AddIcon fontSize="inherit" />
          </ToolbarIconButton>
        }
      >
        <Stack
          direction="row"
          flex="auto"
          alignItems="center"
          ref={dropRef}
          data-testid="toolbar-droppable"
          style={{ gap: 1 }}
          overflow="hidden"
        >
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
          <ButtonBase className={classes.button} onDoubleClick={actions.addTab} />
        </Stack>
      </PanelToolbar>
    </Stack>
  );
}
