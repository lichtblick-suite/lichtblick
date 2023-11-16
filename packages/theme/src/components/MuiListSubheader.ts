// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { OverrideComponentReturn } from "../types";

export const MuiListSubheader: OverrideComponentReturn<"MuiListSubheader"> = {
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
      borderBottom: `1px solid ${theme.palette.divider}`,
      backgroundColor: theme.palette.background.paper,
      borderTop: `1px solid ${theme.palette.divider}`,
      top: -1,
      marginTop: -1,
    }),
  },
};
