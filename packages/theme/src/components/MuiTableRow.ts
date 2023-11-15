// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { tableCellClasses } from "@mui/material";

import { OverrideComponentReturn } from "../types";

export const MuiTableRow: OverrideComponentReturn<"MuiTableRow"> = {
  styleOverrides: {
    root: ({ theme }) => ({
      "&.Mui-disabled": {
        [`.${tableCellClasses.root}`]: {
          color: theme.palette.text.disabled,
        },
      },
    }),
  },
};
