// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles<void, "error">()((theme, _params, classes) => ({
  autocomplete: {
    ".MuiInputBase-root.MuiInputBase-sizeSmall": {
      paddingInline: 0,
      paddingBlock: theme.spacing(0.3125),
    },
  },
  clearIndicator: {
    marginRight: theme.spacing(-0.25),
    opacity: theme.palette.action.disabledOpacity,

    ":hover": {
      background: "transparent",
      opacity: 1,
    },
  },
  error: {},
  fieldLabel: {
    color: theme.palette.text.secondary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fieldWrapper: {
    minWidth: theme.spacing(14),
    marginRight: theme.spacing(0.5),
    [`&.${classes.error} .MuiInputBase-root, .MuiInputBase-root.${classes.error}`]: {
      outline: `1px ${theme.palette.error.main} solid`,
      outlineOffset: -1,
    },
  },
  multiLabelWrapper: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    columnGap: theme.spacing(0.5),
    height: "100%",
    width: "100%",
    alignItems: "center",
    textAlign: "end",
  },
  styledToggleButtonGroup: {
    backgroundColor: theme.palette.action.hover,
    gap: theme.spacing(0.25),
    overflowX: "auto",

    "& .MuiToggleButtonGroup-grouped": {
      margin: theme.spacing(0.55),
      borderRadius: theme.shape.borderRadius,
      paddingTop: 0,
      paddingBottom: 0,
      borderColor: "transparent !important",
      lineHeight: 1.75,

      "&.Mui-selected": {
        background: theme.palette.background.paper,
        borderColor: "transparent",

        "&:hover": {
          borderColor: theme.palette.action.active,
        },
      },
      "&:not(:first-of-type)": {
        borderRadius: theme.shape.borderRadius,
      },
      "&:first-of-type": {
        borderRadius: theme.shape.borderRadius,
      },
    },
  },
  slider: {
    color: theme.palette.secondary.main,
    top: "2px",
    height: 3,
    width: "calc(100% - 30px)",
    left: "10px",

    "& .MuiSlider-thumb": {
      "&:focus, &:hover, &.Mui-active, &.Mui-focusVisible": {
        boxShadow: "none",
      },
    },
  },
}));
