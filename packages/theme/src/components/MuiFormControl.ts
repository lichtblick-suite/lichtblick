// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { inputBaseClasses } from "@mui/material";

import { OverrideComponentReturn } from "../types";

export const MuiFormControl: OverrideComponentReturn<"MuiFormControl"> = {
  defaultProps: {
    variant: "standard",
  },
  styleOverrides: {
    root: {
      [`label[data-shrink=false] + .${inputBaseClasses.formControl}`]: {
        [`.${inputBaseClasses.input}::placeholder`]: {
          opacity: "0.6 !important",
        },
      },
    },
  },
};
