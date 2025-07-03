// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  leftNav: {
    boxSizing: "content-box",
    borderRight: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  tabs: {
    flexGrow: 1,

    ".MuiTabs-flexContainerVertical": {
      height: "100%",
    },
  },
  tab: {
    padding: theme.spacing(1.625),
    minWidth: 50,
  },
  badge: {
    "> *:not(.MuiBadge-badge)": {
      width: "1.5rem",
      height: "1.5rem",
      fontSize: "1.5rem",
      display: "flex",

      ".root-span": {
        display: "contents",
      },
      svg: {
        fontSize: "inherit",
        width: "auto",
        height: "auto",
      },
    },
  },
  mosaicWrapper: {
    flex: "1 1 100%",

    // Root drop targets in this top level sidebar mosaic interfere with drag/mouse events from the
    // PanelList. We don't allow users to edit the mosaic since it's just used for the sidebar, so we
    // can hide the drop targets.
    "& > .mosaic > .drop-target-container": {
      display: "none !important",
    },
  },
}));
