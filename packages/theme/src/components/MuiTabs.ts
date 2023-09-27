// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { tabsClasses } from "@mui/material/Tabs";

import { OverrideComponentReturn } from "../types";

export const MuiTabs: OverrideComponentReturn<"MuiTabs"> = {
  styleOverrides: {
    vertical: {
      [`.${tabsClasses.indicator}`]: {
        left: 0,
        right: "auto",
      },
    },
  },
};
