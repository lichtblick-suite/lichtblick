// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable @lichtblick/no-restricted-imports */

import { ListItem, MenuItem, styled as muiStyled } from "@mui/material";

export const StyledListItem = muiStyled(ListItem, {
  shouldForwardProp: (prop) =>
    prop !== "hasModifications" && prop !== "deletedOnServer" && prop !== "editingName",
})<{ editingName: boolean; hasModifications: boolean; deletedOnServer: boolean }>(
  ({ editingName, hasModifications, deletedOnServer, theme }) => ({
    ".MuiListItemSecondaryAction-root": {
      right: theme.spacing(0.25),
    },
    ".MuiListItemButton-root": {
      maxWidth: "100%",
    },
    "@media (pointer: fine)": {
      ".MuiListItemButton-root": {
        paddingRight: theme.spacing(4.5),
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
  }),
);

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
