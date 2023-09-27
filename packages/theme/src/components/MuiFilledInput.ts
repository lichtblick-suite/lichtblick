// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { alpha, filledInputClasses } from "@mui/material";

import { OverrideComponentReturn } from "../types";

export const MuiFilledInput: OverrideComponentReturn<"MuiFilledInput"> = {
  defaultProps: {
    disableUnderline: true,
    color: "secondary",
  },
  styleOverrides: {
    input: ({ theme }) => ({
      padding: theme.spacing(1, 1.125),
    }),
    inputSizeSmall: ({ theme }) => ({
      padding: theme.spacing(0.75, 1),
    }),
    root: ({ theme }) => ({
      borderRadius: theme.shape.borderRadius,

      "&.Mui-focused": {
        backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.focusOpacity),

        [`&.${filledInputClasses.colorSecondary}`]: {
          backgroundColor: alpha(theme.palette.secondary.main, theme.palette.action.focusOpacity),
        },
        [`&.${filledInputClasses.error}`]: {
          backgroundColor: alpha(theme.palette.error.main, theme.palette.action.focusOpacity),
        },
      },
      "&.Mui-disabled": {
        opacity: 0.5,
      },
      "&.Mui-error": {
        backgroundColor: alpha(theme.palette.error.main, 0.06),
      },
    }),
  },
};
