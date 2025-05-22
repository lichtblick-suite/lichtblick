// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { buttonClasses } from "@mui/material";
import tinycolor from "tinycolor2";
import { makeStyles } from "tss-react/mui";

export default makeStyles()((theme) => ({
  chartOverlay: {
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: "none",
  },
  row: {
    paddingInline: theme.spacing(1, 0.5),
    pointerEvents: "none",
  },
  dismissIcon: {
    paddingInline: theme.spacing(0.5),
    minWidth: "auto !important",
  },
  buttonGroup: {
    minWidth: "auto",
    textAlign: "left",
    pointerEvents: "auto",
    fontWeight: "normal",
    maxWidth: "100%",

    [`.${buttonClasses.root}`]: {
      backgroundColor: tinycolor(theme.palette.background.paper).setAlpha(0.67).toString(),
      paddingBlock: theme.spacing(0.25),
      borderColor: theme.palette.background.paper,

      "&:hover": {
        backgroundImage: `linear-gradient(to right, ${theme.palette.action.hover}, ${theme.palette.action.hover})`,
      },
    },
    [`.${buttonClasses.endIcon}`]: {
      opacity: 0.8,
      marginLeft: theme.spacing(0.5),
      marginRight: theme.spacing(-0.75),
    },
  },
}));
