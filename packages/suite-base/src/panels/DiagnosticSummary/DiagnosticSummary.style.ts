// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  iconButtonClasses,
  inputBaseClasses,
  listItemTextClasses,
  selectClasses,
} from "@mui/material";
import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  listItemButton: {
    padding: 0,

    [`.${iconButtonClasses.root}`]: {
      visibility: "hidden",

      "&:hover": {
        backgroundColor: "transparent",
      },
    },
    [`.${listItemTextClasses.root}`]: {
      gap: theme.spacing(1),
      display: "flex",
    },
    [`&:hover .${iconButtonClasses.root}`]: {
      visibility: "visible",
    },
  },
  select: {
    [`.${inputBaseClasses.input}.${selectClasses.select}.MuiInputBase-sizeSmall`]: {
      paddingTop: 0,
      paddingBottom: 0,
      minWidth: 40,
    },
    [`.${listItemTextClasses.root}`]: {
      marginTop: 0,
      marginBottom: 0,
    },
  },
}));
