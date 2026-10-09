// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable @lichtblick/no-restricted-imports, no-restricted-imports */

import { ListItem, MenuItem, styled as muiStyled } from "@mui/material";

export const StyledListItem = muiStyled(ListItem, {
  shouldForwardProp: (prop) =>
    prop !== "hasModifications" &&
    prop !== "deletedOnServer" &&
    prop !== "editingName" &&
    prop !== "hasFavoriteAction",
})<{
  editingName: boolean;
  hasModifications: boolean;
  deletedOnServer: boolean;
  hasFavoriteAction: boolean;
}>(({ editingName, hasModifications, deletedOnServer, hasFavoriteAction, theme }) => ({
  ".MuiListItemSecondaryAction-root": {
    right: theme.spacing(0.25),
    display: "flex",
    alignItems: "center",
  },
  ".MuiListItemButton-root": {
    maxWidth: "100%",
    ...(hasFavoriteAction && { paddingRight: theme.spacing(10) }),
  },
  // A favorite star stays visible even while the other row actions are hidden.
  ".layout-favorite-active": {
    visibility: "visible",
  },
  "@media (pointer: fine)": {
    ".MuiListItemButton-root": {
      paddingRight: theme.spacing(hasFavoriteAction ? 8.5 : 4.5),
    },
    ".MuiListItemSecondaryAction-root": {
      visibility: !hasModifications && !deletedOnServer && "hidden",
    },
    "&:hover .MuiListItemSecondaryAction-root": {
      visibility: "visible",
    },
  },
  ...(editingName && {
    ".MuiListItemButton-root": {
      paddingTop: theme.spacing(0.5),
      paddingBottom: theme.spacing(0.5),
      paddingLeft: theme.spacing(1),
    },
    ".MuiListItemText-root": {
      margin: 0,
    },
  }),
}));

export const StyledMenuItem = muiStyled(MenuItem, {
  shouldForwardProp: (prop) => prop !== "debug",
})<{ debug?: boolean }>(({ theme, debug = false }) => ({
  position: "relative",

  ...(debug && {
    "&:before": {
      content: "''",
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: theme.palette.warning.main,
      backgroundImage: `repeating-linear-gradient(${[
        "-35deg",
        "transparent",
        "transparent 6px",
        `${theme.palette.common.black} 6px`,
        `${theme.palette.common.black} 12px`,
      ].join(",")})`,
    },
  }),
}));
