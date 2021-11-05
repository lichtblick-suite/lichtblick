// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "@fluentui/react";
import { PropsWithChildren } from "react";

import "@foxglove/studio-base/styles/assets/inter.css";
import "@foxglove/studio-base/styles/assets/plex-mono.css";

import { colors, fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const useStyles = makeStyles((theme) => ({
  root: {
    "*,*:before,*:after": {
      boxSizing: "inherit",
    },
    "code, pre, tt": {
      fontFamily: fonts.MONOSPACE,
      overflowWrap: "break-word",
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
        background: theme.palette.blackTranslucent40,
        borderRadius: "2px",
      },
    },
    p: {
      margin: "1em 0",

      ":last-child": {
        marginBottom: 0,
      },
    },
    "b, strong": {
      fontWeight: 700,
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
    fontFeatureSettings: fonts.SANS_SERIF_FEATURE_SETTINGS,

    // mosaic styling
    ".mosaic": {
      ".mosaic-root": {
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,

        ".drop-target-container .drop-target": {
          backgroundColor: theme.palette.neutralQuaternary,
          border: `2px solid ${theme.palette.neutralDark}`,
        },
        ".drop-target-container .drop-target-hover": {
          opacity: 0.3,
        },
      },
      ".mosaic-tile": {
        // make room for splitters - unfortunately this means the background color will show
        // through even if the tile has its own background color set
        margin: 1,
      },
      ".mosaic-window": {
        boxShadow: "none",
        width: "100%",

        // we use custom toolbars
        ".mosaic-window-toolbar": {
          display: "none",
        },
        ".mosaic-window-body": {
          flex: "1 1 auto",
          display: "flex",
          background: "unset",
          zIndex: "unset",
        },
      },
      ".mosaic-preview": {
        maxHeight: "none",

        // we use custom toolbars
        ".mosaic-window-toolbar": {
          display: "none",
        },
        ".mosaic-window-body": {
          flex: "1 1 auto",
          display: "flex",
          background: "unset",
          zIndex: "unset",
        },
      },
      ".mosaic-window-toolbar": {
        display: "none",
      },
      ".mosaic-window-body": {
        flex: "1 1 auto",
        display: "flex",
        background: "unset",
        zIndex: "unset",
      },
      ".mosaic-window-title": {
        fontSize: "12px",
        lineHeight: "30px",
        paddingLeft: "5px",
        color: colors.GREY,
      },
      ".mosaic-split": {
        background: "none !important",
        zIndex: 99,

        ".mosaic-split-line": {
          boxShadow: `0 0 0 1px ${theme.palette.neutralLighter}`,
        },
        ":hover .mosaic-split-line": {
          boxShadow: `0 0 0 1px ${theme.palette.neutralQuaternary}`,
        },
        "&.-row": {
          marginTop: 2,
        },
      },
      "&.borderless": {
        ".mosaic-split": {
          opacity: 0,

          "&:hover": {
            opacity: 1,
          },
        },
        ".mosaic-tile": {
          margin: 0,
        },
      },
    },
  },
}));

export default function CssBaseline(props: PropsWithChildren<unknown>): JSX.Element {
  const styles = useStyles();

  // styles scoped to our container
  const className = styles.root;

  return <div className={className}>{props.children}</div>;
}
