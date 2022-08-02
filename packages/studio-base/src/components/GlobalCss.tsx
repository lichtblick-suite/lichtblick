// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { GlobalStyles, useTheme } from "@mui/material";

/** GlobalCss component configures html, body, and #root with theme elements */
export default function GlobalCss(): JSX.Element {
  const theme = useTheme();

  return (
    <GlobalStyles
      styles={{
        "html, body": {
          boxSizing: "border-box",
          margin: 0,
          padding: 0,
          height: "100%",
          width: "100%",

          // https://github.com/necolas/normalize.css/blob/master/normalize.css#L12
          lineHeight: 1.15,
        },
        "*, *:before, *:after": {
          boxSizing: "inherit",
        },
        body: {
          background: theme.palette.background.default,
          color: theme.palette.text.primary,
          font: "inherit",
          fontFamily: theme.typography.body2.fontFamily,
          fontFeatureSettings: theme.typography.body2.fontFeatureSettings,
          fontSize: theme.typography.body2.fontSize,
          fontWeight: theme.typography.body2.fontWeight,

          // Prevent scroll "bouncing" since the app workspace is not scrollable. Allows individual
          // scrollable elements to be scrolled without the whole page moving (even if they don't
          // preventDefault on scroll events).
          overscrollBehavior: "none",
        },
        "#root": {
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
      }}
    />
  );
}
