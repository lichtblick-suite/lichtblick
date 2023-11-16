// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Checkbox } from "@mui/material";

import { OverrideComponentReturn } from "../types";

export const MuiDataGrid: OverrideComponentReturn<"MuiDataGrid"> = {
  defaultProps: {
    slots: {
      baseSwitch: Checkbox,
    },
    slotProps: {
      panel: {
        popperOptions: {
          placement: "bottom-end",
        },
      },
      baseTextField: {
        variant: "outlined",
        size: "small",
        label: undefined,
      },
      baseSwitch: {
        size: "medium",
        sx: {
          padding: 0.5,
        },
      },
    },
  },
  styleOverrides: {
    root: {
      // Disable focus outline by default since most of our grids are used
      // as non-interactive display tables
      "& .MuiDataGrid-cell:focus": {
        outline: "none",
      },
    },
    columnsPanel: {
      padding: 0,
    },
    panelHeader: ({ theme }) => ({
      padding: theme.spacing(1.5),
    }),
    panelContent: ({ theme }) => ({
      padding: theme.spacing(0, 1.5, 1.5),
    }),
    panelFooter: ({ theme }) => ({
      borderTop: `1px solid ${theme.palette.divider}`,
    }),
  },
};
