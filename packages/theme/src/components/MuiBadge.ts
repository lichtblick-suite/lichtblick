// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { OverrideComponentReturn } from "../types";

export const MuiBadge: OverrideComponentReturn<"MuiBadge"> = {
  styleOverrides: {
    badge: ({ theme }) => ({
      height: 16,
      minWidth: 16,
      padding: theme.spacing(0, 0.25),
      fontFeatureSettings: "normal",
    }),
  },
};
