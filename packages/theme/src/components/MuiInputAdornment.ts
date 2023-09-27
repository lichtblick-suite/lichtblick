// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { inputAdornmentClasses } from "@mui/material";

import { OverrideComponentReturn } from "../types";

export const MuiInputAdornment: OverrideComponentReturn<"MuiInputAdornment"> = {
  defaultProps: {},
  styleOverrides: {
    root: {
      [`&.${inputAdornmentClasses.filled}`]: {
        [`&.${inputAdornmentClasses.positionStart}, &.${inputAdornmentClasses.positionEnd}`]: {
          [`:not(.${inputAdornmentClasses.hiddenLabel})`]: {
            marginTop: 0,
          },
        },
      },
    },
    positionStart: {
      marginRight: 0,
    },
    positionEnd: {
      marginLeft: 0,
    },
  },
};
