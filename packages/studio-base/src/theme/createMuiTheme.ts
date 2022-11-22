// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createTheme, Theme } from "@mui/material/styles";

import muiComponents from "./muiComponents";
import typography from "./muiTypography";
import * as palette from "./palette";

type ThemePreference = "dark" | "light";

export function createMuiTheme(
  themePreference: ThemePreference,
): Theme & { name: ThemePreference } {
  const theme = createTheme({
    palette: palette[themePreference],
    shape: { borderRadius: 2 },
    typography,
  });

  // add name for storybook
  return {
    ...theme,
    name: themePreference,
    components: muiComponents(theme),
  };
}
