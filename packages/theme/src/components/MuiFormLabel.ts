// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { inputBaseClasses, inputClasses } from "@mui/material";

import { OverrideComponentReturn } from "../types";

export const MuiFormLabel: OverrideComponentReturn<"MuiFormLabel"> = {
  styleOverrides: {
    root: ({ theme }) => ({
      marginBottom: theme.spacing(0.5),
      fontSize: "0.75rem",
      padding: theme.spacing(0.325, 0),

      [`& + .${inputBaseClasses.root}.${inputClasses.root}`]: {
        marginTop: 0,
      },
    }),
  },
};
