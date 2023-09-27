// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { buttonClasses } from "@mui/material";

import { OverrideComponentReturn } from "../types";

export const MuiButton: OverrideComponentReturn<"MuiButton"> = {
  defaultProps: {
    disableElevation: true,
  },
  styleOverrides: {
    root: {
      transition: "none",
    },
    containedInherit: ({ theme }) => ({
      backgroundColor: theme.palette.action.focus,
    }),
    sizeSmall: {
      [`&.${buttonClasses.text}`]: {
        fontSize: "0.625rem",
      },
      [`&.${buttonClasses.contained}`]: {
        fontSize: "0.625rem",
      },
      [`&.${buttonClasses.outlined}`]: {
        fontSize: "0.625rem",
      },
    },
    sizeLarge: {
      [`&.${buttonClasses.text}`]: {
        fontSize: "0.875rem",
      },
      [`&.${buttonClasses.contained}`]: {
        fontSize: "0.875rem",
      },
      [`&.${buttonClasses.outlined}`]: {
        fontSize: "0.875rem",
      },
    },
  },
};
