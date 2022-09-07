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

import { Link, Typography, styled as muiStyled } from "@mui/material";
import { useCallback } from "react";
import { useDrop } from "react-dnd";
import { MosaicDragType } from "react-mosaic-component";

import PanelList, { PanelSelection } from "@foxglove/studio-base/components/PanelList";
import Stack from "@foxglove/studio-base/components/Stack";
import { useCurrentLayoutActions } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { MosaicDropResult } from "@foxglove/studio-base/types/panels";
import { getPanelIdForType } from "@foxglove/studio-base/util/layout";

type Props = {
  tabId?: string;
};

const Root = muiStyled("div")(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  width: "100%",
  height: "100%",
  overflowY: "auto",
}));

const DropTarget = muiStyled("div", {
  shouldForwardProp: (prop) => prop !== "isOver",
})<{
  isOver: boolean;
}>(({ isOver, theme }) => ({
  width: "100%",
  height: "100%",
  minHeight: 0,

  ...(isOver && {
    "&:after": {
      content: "''",
      borderColor: `1px solid ${theme.palette.action.selected}`,
      backgroundColor: theme.palette.action.focus,
      position: "absolute",
      top: 0,
      right: 0,
      left: 0,
      bottom: 0,
      zIndex: theme.zIndex.appBar,
    },
  }),
}));

export const EmptyPanelLayout = ({ tabId }: Props): JSX.Element => {
  const { addPanel } = useCurrentLayoutActions();

  const [{ isOver }, drop] = useDrop<unknown, MosaicDropResult, { isOver: boolean }>({
    accept: MosaicDragType.WINDOW,
    drop: () => {
      return { tabId };
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const onPanelSelect = useCallback(
    ({ type, config, relatedConfigs }: PanelSelection) => {
      const id = getPanelIdForType(type);
      addPanel({ tabId, id, config, relatedConfigs });
    },
    [addPanel, tabId],
  );

  return (
    <DropTarget isOver={isOver} ref={drop} data-testid="empty-drop-target">
      <Root>
        <Stack paddingBottom={2}>
          <Typography variant="body2" paddingX={2} paddingTop={2}>
            Select a panel below to add it to your layout.{" "}
            <Link color="primary" target="_blank" href="https://foxglove.dev/docs/studio/layouts">
              Learn more
            </Link>
          </Typography>
          <PanelList mode="grid" onPanelSelect={onPanelSelect} />
        </Stack>
      </Root>
    </DropTarget>
  );
};
