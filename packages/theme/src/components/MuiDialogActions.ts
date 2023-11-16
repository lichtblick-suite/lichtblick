// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { OverrideComponentReturn } from "../types";

export const MuiDialogActions: OverrideComponentReturn<"MuiDialogActions"> = {
  styleOverrides: {
    root: ({ theme }) => ({
      gap: theme.spacing(1),
      padding: theme.spacing(3),

      "& > :not(:first-of-type)": {
        marginLeft: "inherit",
      },
    }),
  },
};
