// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { OverrideComponentReturn } from "../types";

export const MuiOutlinedInput: OverrideComponentReturn<"MuiOutlinedInput"> = {
  defaultProps: {
    notched: false,
  },
  styleOverrides: {
    input: ({ theme }) => ({
      boxSizing: "content-box",
      padding: theme.spacing(1, 1.25),
    }),
    inputSizeSmall: ({ theme }) => ({
      padding: theme.spacing(0.75, 1),
    }),
  },
};
