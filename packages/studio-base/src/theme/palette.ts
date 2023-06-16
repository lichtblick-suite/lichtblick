// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PaletteOptions } from "@mui/material/styles";
import { CSSProperties } from "react";

declare module "@mui/material/styles" {
  interface Palette {
    name: string;
    appBar: {
      main: CSSProperties["color"];
      primary: CSSProperties["color"];
      text: CSSProperties["color"];
    };
  }
  interface PaletteOptions {
    name: string;
    appBar: {
      main: CSSProperties["color"];
      primary: CSSProperties["color"];
      text: CSSProperties["color"];
    };
  }
  interface TypeBackground {
    menu: CSSProperties["color"];
  }
}

export const dark: PaletteOptions = {
  name: "dark",
  mode: "dark",
  tonalOffset: 0.15,
  appBar: {
    main: "#35363A",
    primary: "#9480ed",
    text: "#ffffff",
  },
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
  divider: "#585861",
  background: {
    default: "#15151a",
    paper: "#27272b",
    menu: "#35363A",
  },
  grey: {
    50: "#121217",
    100: "#16161b",
    200: "#212127",
    300: "#27272b",
    400: "#2d2d33",
    500: "#2f2f35",
    600: "#33333a",
    700: "#35353d",
    800: "#3b3b44",
    900: "#45474d",
    A100: "#313138",
    A200: "#60636c",
    A400: "#aeb0b7",
    A700: "#d2d5df",
  },
};

export const light: PaletteOptions = {
  name: "light",
  mode: "light",
  tonalOffset: 0.22,
  appBar: {
    main: "#27272b",
    primary: "#9480ed",
    text: "#ffffff",
  },
  primary: { main: "#6f3be8" },
  secondary: { main: "#808080" },
  error: { main: "#db3553" },
  warning: { main: "#eba800" },
  success: { main: "#107c10" },
  info: { main: "#1EA7FD" },
  background: {
    default: "#f4f4f5",
    paper: "#ffffff",
    menu: "#ffffff",
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
