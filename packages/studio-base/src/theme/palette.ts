// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PaletteOptions } from "@mui/material/styles";

type CustomPaletteOptions = {
  name: string;
};

export const dark: PaletteOptions & CustomPaletteOptions = {
  name: "dark",
  mode: "dark",
  primary: { main: "#9480ed" },
  secondary: { main: "#b1b1b1" },
  error: { main: "#f54966" },
  warning: { main: "#eba800" },
  success: { main: "#92c353" },
  info: { main: "#29bee7" },
  text: {
    primary: "#e1e1e4",
    secondary: "#a7a6af",
  },
  divider: "#585858",
  background: {
    default: "#121217",
    paper: "#27272b",
  },
  grey: {
    50: "#121212",
    100: "#1E1E1E",
    200: "#222222",
    300: "#272727",
    400: "#2C2C2C",
    500: "#2E2E2E",
    600: "#333333",
    700: "#353535",
    800: "#383838",
    900: "#454545",
    A100: "#303030",
    A200: "#616161",
    A400: "#aaaaaa",
    A700: "#d5d5d5",
  },
};

export const light: PaletteOptions & CustomPaletteOptions = {
  name: "light",
  mode: "light",
  primary: { main: "#6f3be8" },
  secondary: { main: "#808080" },
  error: { main: "#db3553" },
  warning: { main: "#eba800" },
  success: { main: "#107c10" },
  info: { main: "#1EA7FD" },
  background: {
    default: "#f4f4f5",
    paper: "#ffffff",
  },
  text: {
    primary: "#393939",
    secondary: "#6f6d79",
  },
  divider: "#D6d6d6",
  grey: {
    50: "#fafafa",
    100: "#f5f5f5",
    200: "#eeeeee",
    300: "#e0e0e0",
    400: "#bdbdbd",
    500: "#9e9e9e",
    600: "#757575",
    700: "#616161",
    800: "#424242",
    900: "#212121",
    A100: "#d5d5d5",
    A200: "#aaaaaa",
    A400: "#616161",
    A700: "#303030",
  },
};
