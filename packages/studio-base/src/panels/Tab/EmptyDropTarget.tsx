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

import { Link, Stack, Text, makeStyles, useTheme } from "@fluentui/react";
import cx from "classnames";
import { useCallback } from "react";
import { useDrop } from "react-dnd";
import { MosaicDragType } from "react-mosaic-component";

import ChildToggle from "@foxglove/studio-base/components/ChildToggle";
import EmptyBoxIcon from "@foxglove/studio-base/components/EmptyBoxIcon";
import Menu from "@foxglove/studio-base/components/Menu";
import PanelList, { PanelSelection } from "@foxglove/studio-base/components/PanelList";
import { useCurrentLayoutActions } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { MosaicDropResult } from "@foxglove/studio-base/types/panels";
import { getPanelIdForType } from "@foxglove/studio-base/util/layout";

const useStyles = makeStyles((theme) => ({
  dropzone: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    border: "1px solid transparent",
  },
  dropzoneOver: {
    backgroundColor: theme.palette.neutralLighterAlt,
    borderColor: theme.palette.neutralLight,
  },
}));

type Props = {
  tabId?: string;
};

export const EmptyDropTarget = ({ tabId }: Props): JSX.Element => {
  const theme = useTheme();
  const classes = useStyles();
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
    <div
      ref={drop}
      data-test="empty-drop-target"
      className={cx(classes.dropzone, {
        [classes.dropzoneOver]: isOver,
      })}
    >
      <Stack
        horizontalAlign="center"
        verticalFill
        verticalAlign="center"
        tokens={{ childrenGap: theme.spacing.m, padding: theme.spacing.m }}
      >
        <EmptyBoxIcon />

        <Text
          variant="mediumPlus"
          styles={{
            root: {
              color: theme.semanticColors.disabledText,
              textAlign: "center",
              lineHeight: "1.5",
            },
          }}
        >
          Nothing here yet.
          <br />
          <ChildToggle position="below" style={{ display: "inline-flex" }}>
            <Link underline data-test="pick-a-panel">
              Pick a panel
            </Link>
            <Menu>
              <PanelList onPanelSelect={onPanelSelect} />
            </Menu>
          </ChildToggle>{" "}
          or drag one in to get started.
        </Text>
      </Stack>
    </div>
  );
};
