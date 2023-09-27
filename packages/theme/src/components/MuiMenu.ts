// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Fade } from "@mui/material";
import { dividerClasses } from "@mui/material/Divider";
import { listClasses } from "@mui/material/List";
import { listItemClasses } from "@mui/material/ListItem";

import { OverrideComponentReturn } from "../types";

export const MuiMenu: OverrideComponentReturn<"MuiMenu"> = {
  defaultProps: {
    TransitionComponent: Fade,
  },
  styleOverrides: {
    paper: ({ theme }) => ({
      borderRadius: theme.shape.borderRadius,
      backgroundColor: theme.palette.background.menu,
    }),
    list: ({ theme }) => ({
      ...theme.typography.body1,

      [`&.${listClasses.dense}`]: {
        ...theme.typography.body2,
      },
      [`.${listItemClasses.root} + .${dividerClasses.root}`]: {
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1),
      },
    }),
  },
};
