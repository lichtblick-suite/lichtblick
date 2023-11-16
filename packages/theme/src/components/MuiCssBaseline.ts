// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { OverrideComponentReturn } from "../types";

export const MuiCssBaseline: OverrideComponentReturn<"MuiCssBaseline"> = {
  styleOverrides: (theme) => ({
    svg: {
      display: "block",
      maxWidth: "100%",
    },
    a: {
      color: "inherit",
      textDecoration: "none",
    },
    pre: {
      fontFamily: theme.typography.fontMonospace,
      backgroundColor: theme.palette.background.default,
      borderRadius: theme.shape.borderRadius,
      padding: theme.spacing(2),
      overflow: "auto",
      color: theme.palette.text.secondary,
      margin: 0,
    },
    code: {
      fontFamily: theme.typography.fontMonospace,
    },
  }),
};
