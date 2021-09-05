// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mergeStyles, useTheme } from "@fluentui/react";
import { PropsWithChildren } from "react";

import "@foxglove/studio-base/styles/assets/latin-roboto-mono.scss";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

export default function CssBaseline(props: PropsWithChildren<unknown>): JSX.Element {
  const theme = useTheme();

  // styles scoped to our container
  const className = mergeStyles({
    "*,*:before,*:after": {
      boxSizing: "inherit",
    },
    "code, pre, tt": {
      fontFamily: fonts.MONOSPACE,
      overflowWrap: "break-word",
    },
    code: {
      padding: "0 0.25em",
      backgroundColor: theme.semanticColors.bodyBackgroundHovered,
      borderRadius: "0.2em",
    },
    div: {
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
    p: {
      margin: "1em 0",

      ":last-child": {
        marginBottom: 0,
      },
    },
    "b,strong": {
      fontWeight: "bolder",
    },
    table: {
      borderCollapse: "collapse",
      borderSpacing: 0,
    },
    "th, td": {
      textAlign: "left",
      verticalAlign: "top",
    },

    // container styling
    height: "100%",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: "1 1 100%",
    overflow: "hidden",
    background: theme.semanticColors.bodyBackground,
    color: theme.semanticColors.bodyText,
    font: "inherit",
    ...theme.fonts.small,
  });

  return <div className={className}>{props.children}</div>;
}
