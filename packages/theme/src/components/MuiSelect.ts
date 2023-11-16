// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { inputBaseClasses, selectClasses } from "@mui/material";

import { OverrideComponentReturn } from "../types";

export const MuiSelect: OverrideComponentReturn<"MuiSelect"> = {
  defaultProps: {
    variant: "outlined",
  },
  styleOverrides: {
    root: {
      transition: "none",

      [`&.${inputBaseClasses.sizeSmall}`]: {
        lineHeight: "1.25em !important",
      },
    },
    standard: ({ theme }) => ({
      [`&.${selectClasses.select}`]: {
        paddingInlineEnd: theme.spacing(4),
      },
    }),
    iconStandard: ({ theme }) => ({
      right: theme.spacing(0.75),
    }),
  },
};
