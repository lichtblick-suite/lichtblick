// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { iconButtonClasses, tableRowClasses } from "@mui/material";
import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  resizeHandle: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 12,
    marginLeft: -6,
    cursor: "col-resize",

    "&:hover, &:active, &:focus": {
      outline: "none",

      "&::after": {
        content: '""',
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 6,
        marginLeft: -2,
        width: 4,
        backgroundColor: theme.palette.action.focus,
      },
    },
  },
  table: {
    "@media (pointer: fine)": {
      [`.${tableRowClasses.root} .${iconButtonClasses.root}`]: { visibility: "hidden" },
      [`.${tableRowClasses.root}:hover .${iconButtonClasses.root}`]: { visibility: "visible" },
    },
  },
  tableHeaderRow: {
    backgroundColor: theme.palette.background.paper,
  },
  htmlTableCell: {
    "h1, h2, h3, h4, h5, h6": {
      fontFamily: theme.typography.subtitle2.fontFamily,
      fontSize: theme.typography.subtitle2.fontSize,
      lineHeight: theme.typography.subtitle2.lineHeight,
      letterSpacing: theme.typography.subtitle2.letterSpacing,
      fontWeight: 800,
      margin: 0,
    },
  },
  iconButton: {
    "&:hover, &:active, &:focus": {
      backgroundColor: "transparent",
    },
  },
}));
