// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  root: {
    boxSizing: "content-box",
    backgroundColor: theme.palette.background.paper,
  },
  badgeRoot: {
    display: "flex",
    alignItems: "baseline",
    gap: theme.spacing(1),
  },
  badge: {
    fontSize: theme.typography.caption.fontSize,
    padding: theme.spacing(0.125, 0.75),
    borderRadius: 8,
    transform: "none",
    position: "relative",
  },
  badgeInvisible: {
    display: "none",
  },
  anchorRight: {
    borderLeft: `1px solid ${theme.palette.divider}`,
  },
  anchorLeft: {
    borderRight: `1px solid ${theme.palette.divider}`,
  },
  tabs: {
    minHeight: "auto",
    flex: "1 1 auto",
    overflow: "hidden",
    paddingLeft: theme.spacing(0.25),

    ".MuiTabs-indicator": {
      transform: "scaleX(0.5)",
      height: 2,
    },
    ".MuiTab-root": {
      minHeight: 30,
      minWidth: theme.spacing(4),
      padding: theme.spacing(0, 1),
      color: theme.palette.text.secondary,
      fontSize: "0.6875rem",

      "&.Mui-selected": {
        color: theme.palette.text.primary,
      },
    },
  },
  iconButton: {
    padding: theme.spacing(0.91125), // round out the overall height to 30px
    color: theme.palette.text.secondary,
    borderRadius: 0,

    ":hover": {
      color: theme.palette.text.primary,
    },
  },
  tabContent: {
    flex: "auto",
    overflow: "auto",
  },
}));
