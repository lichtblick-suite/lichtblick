// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { alpha, inputClasses } from "@mui/material";

import { OverrideComponentReturn } from "../types";

export const MuiInput: OverrideComponentReturn<"MuiInput"> = {
  defaultProps: {
    disableUnderline: true,
  },
  styleOverrides: {
    root: ({ theme }) => ({
      borderRadius: theme.shape.borderRadius,

      ":hover": {
        backgroundColor: theme.palette.action.hover,
      },
      "&.Mui-focused": {
        backgroundColor: theme.palette.action.focus,

        [`&.${inputClasses.error}`]: {
          backgroundColor: alpha(theme.palette.error.main, theme.palette.action.focusOpacity),
        },
      },
      "&.Mui-error": {
        backgroundColor: alpha(theme.palette.error.main, theme.palette.action.hoverOpacity),
      },
    }),
    input: ({ theme }) => ({
      padding: theme.spacing(1, 1.125),
    }),
    inputSizeSmall: ({ theme }) => ({
      padding: theme.spacing(0.75, 1),
    }),
  },
};
