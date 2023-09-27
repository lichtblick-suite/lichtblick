// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { OverrideComponentReturn } from "../types";

export const MuiDialog: OverrideComponentReturn<"MuiDialog"> = {
  defaultProps: {
    PaperProps: {
      elevation: 4,
    },
  },
  styleOverrides: {
    paper: ({ theme }) => ({
      // Prevent dialog from going underneath window title bar controls on Windows
      maxHeight: `calc(100% - 2 * (env(titlebar-area-height, ${theme.spacing(2)}) + ${theme.spacing(
        2,
      )}))`,
    }),
  },
};
