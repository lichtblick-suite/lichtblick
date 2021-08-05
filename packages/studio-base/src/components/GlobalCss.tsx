// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mergeStyles, useTheme } from "@fluentui/react";

/** GlobalCss component configures html, body, and #root with theme elements */
export default function GlobalCss(): JSX.Element {
  const theme = useTheme();

  // styles scoped to our container
  mergeStyles({
    ":global(html, body)": {
      boxSizing: "border-box",
      margin: 0,
      padding: 0,
      height: "100%",
      width: "100%",

      // https://github.com/necolas/normalize.css/blob/master/normalize.css#L12
      // Provided as a string (rather than number) to prevent mergeStyles from appending "px"
      lineHeight: "1.15",
    },
    ":global(*,*:before,*:after)": {
      boxSizing: "inherit",
    },
    ":global(body)": {
      background: theme.semanticColors.bodyBackground,
      color: theme.semanticColors.bodyText,
      font: "inherit",
      ...theme.fonts.small,
    },
    ":global(#root)": {
      height: "100%",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      flex: "1 1 100%",
      outline: "none",
      overflow: "hidden",
      zIndex: 0,
    },
  });

  return <></>;
}
