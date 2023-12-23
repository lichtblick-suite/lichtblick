// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { OverrideComponentReturn } from "../types";

export const MuiCardHeader: OverrideComponentReturn<"MuiCardHeader"> = {
  defaultProps: {
    titleTypographyProps: {
      variant: "h4",
    },
  },
  styleOverrides: {
    avatar: {
      marginRight: 0,
    },
    action: {
      alignSelf: "auto",
      marginTop: 0,
      marginRight: 0,
    },
    root: ({ theme }) => ({
      gap: theme.spacing(2),
    }),
  },
};
