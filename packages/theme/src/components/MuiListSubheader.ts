// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { OverrideComponentReturn } from "../types";

export const MuiListSubheader: OverrideComponentReturn<"MuiListSubheader"> = {
  defaultProps: {
    disableSticky: true,
  },
  styleOverrides: {
    root: ({ theme }) => ({
      fontFamily: theme.typography.overline.fontFamily,
      fontWeight: 400,
      fontSize: theme.typography.overline.fontSize,
      lineHeight: 3,
      letterSpacing: theme.typography.overline.letterSpacing,
      textTransform: "uppercase",
    }),
    sticky: ({ theme }) => ({
      backgroundColor: theme.palette.background.paper,
    }),
  },
};
