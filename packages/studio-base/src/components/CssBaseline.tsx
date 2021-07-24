// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mergeStyles, useTheme } from "@fluentui/react";

import "@foxglove/studio-base/styles/reset.scss";
import "@foxglove/studio-base/styles/assets/latin-roboto-mono.scss";

import { MONOSPACE } from "@foxglove/studio-base/styles/fonts";

export default function CssBaseline(): ReactNull {
  const theme = useTheme();

  mergeStyles({
    ":global(body, html, #root)": {
      height: "100%",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      flex: "1 1 100%",
      outline: "none",
      overflow: "hidden",
      background: theme.semanticColors.bodyBackground,
      color: theme.semanticColors.bodyText,
      font: "inherit",
      ...theme.fonts.small,
    },
    ":global(#root)": {
      // ensure portals are able to stack on top of the main app
      zIndex: 0,
    },
    ":global(::selection)": {
      backgroundColor: theme.palette.blackTranslucent40,
    },
    ":global(code, pre, tt)": {
      fontFamily: MONOSPACE,
      overflowWrap: "break-word",
    },
    ":global(code)": {
      backgroundColor: theme.semanticColors.bodyBackgroundHovered,
      borderRadius: "0.2em",
    },
    ":global(div)": {
      "::-webkit-scrollbar": {
        width: "4px",
        height: "4px",
      },
      "::-webkit-scrollbar-track": {
        background: "transparent",
      },
      "::-webkit-scrollbar-thumb": {
        background: "rgba(255, 255, 255, 0.1)",
        borderRadius: "2px",
      },
    },
    ":global(a)": {
      color: theme.semanticColors.link,

      ":hover": {
        color: theme.semanticColors.linkHovered,
      },
    },
    ":global(hr)": {
      border: "none",
      display: "block",
      height: "1px",
      margin: "0",
      padding: "0",
      backgroundColor: theme.semanticColors.bodyDivider,
    },
  });

  return ReactNull;
}
