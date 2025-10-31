// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { alpha } from "@mui/material";
import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles<void, "buttonIcon">()((theme, _params, classes) => ({
  svg: {
    label: "DirectionalPad-svg",
    maxHeight: "100%",
    maxWidth: "100%",
  },
  button: {
    label: "DirectionalPad-button",
    cursor: "pointer",
    fill: theme.palette.action.hover,
    stroke: theme.palette.divider,
    strokeWidth: 0.5,

    "&:hover": {
      fill: alpha(
        theme.palette.primary.main,
        theme.palette.action.selectedOpacity + theme.palette.action.hoverOpacity,
      ),
      stroke: theme.palette.primary.main,

      [`& + .${classes.buttonIcon}`]: {
        fill: theme.palette.primary.main,
      },
    },
    "&.active": {
      fill: `${theme.palette.primary.main} !important`,
      stroke: `${theme.palette.primary.dark} !important`,

      "&:hover": {
        [`& + .${classes.buttonIcon}`]: {
          fill: theme.palette.common.white,
        },
      },
    },
    "&.disabled": {
      cursor: "auto",
      strokeWidth: 0,
      fill: theme.palette.action.disabledBackground,

      "&:hover": {
        fill: theme.palette.action.disabledBackground,

        [`& + .${classes.buttonIcon}`]: {
          fill: theme.palette.background.default,
        },
      },
    },
  },
  buttonIcon: {
    pointerEvents: "none",
    label: "DirectionalPad-buttonIcon",
    fill: theme.palette.text.primary,

    "&.disabled": {
      fill: theme.palette.background.default,
    },
  },
}));
