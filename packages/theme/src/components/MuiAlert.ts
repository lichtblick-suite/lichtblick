// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { OverrideComponentReturn } from "../types";

export const MuiAlert: OverrideComponentReturn<"MuiAlert"> = {
  styleOverrides: {
    standard: {
      border: "1px solid",
    },
    standardWarning: ({ theme }) => ({
      borderColor: theme.palette.warning.main,
    }),
    standardError: ({ theme }) => ({
      borderColor: theme.palette.error.main,
    }),
    standardInfo: ({ theme }) => ({
      borderColor: theme.palette.info.main,
    }),
    standardSuccess: ({ theme }) => ({
      border: theme.palette.info.main,
    }),
  },
};
