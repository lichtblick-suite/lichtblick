// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { dialogActionsClasses } from "@mui/material";

import { OverrideComponentReturn } from "../types";

export const MuiDialogContent: OverrideComponentReturn<"MuiDialogContent"> = {
  styleOverrides: {
    root: ({ theme }) => ({
      ...theme.typography.body1,

      [`& + .${dialogActionsClasses.root}`]: {
        paddingTop: 0,
      },
    }),
  },
};
