// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { alpha } from "@mui/material";
import { PropsWithChildren } from "react";
import { makeStyles } from "tss-react/mui";

import "@foxglove/studio-base/styles/assets/inter.css";
import "@foxglove/studio-base/styles/assets/plex-mono.css";

import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const useStyles = makeStyles()(({ palette, typography }) => ({
  root: {
    // container styling
    height: "100%",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: "1 1 100%",
    overflow: "hidden",
    background: palette.background.default,
    color: palette.text.primary,
    font: "inherit",
    fontSize: typography.body2.fontSize,
    fontFeatureSettings: typography.fontFeatureSettings,
    fontFamily: typography.body2.fontFamily,
    fontWeight: typography.body2.fontWeight,
    zIndex: 0,

    // Prevent scroll "bouncing" since the app workspace is not scrollable. Allows individual
    // scrollable elements to be scrolled without the whole page moving (even if they don't
    // preventDefault on scroll events).
    overscrollBehavior: "none",

    // https://github.com/necolas/normalize.css/blob/master/normalize.css#L12
    lineHeight: 1.15,

    /// --- child and element styling follows ---
    "code, pre, tt": {
      fontFamily: fonts.MONOSPACE,
      overflowWrap: "break-word",
    },
    div: {
      "::-webkit-scrollbar": {
        width: 4,
        height: 4,
      },
      "::-webkit-scrollbar-corner": {
        background: "transparent",
      },
      "::-webkit-scrollbar-track": {
        background: "transparent",
      },
      "::-webkit-scrollbar-thumb": {
        background: palette.action.focus,
        borderRadius: 2,
      },
    },
    "p:not([class^='Mui')": {
      margin: "1em 0",

      "&:last-child": {
        marginBottom: 0,
      },
    },
    "b, strong": {
      fontWeight: 700,
    },
    canvas: {
      outline: "none",
    },

    // mosaic styling
    ".mosaic": {
      ".mosaic-root": {
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,

        ".drop-target-container .drop-target": {
          backgroundColor: palette.action.hover,
          border: `2px solid ${alpha(palette.divider, 0.5)}`,
        },
        ".drop-target-container .drop-target-hover": {
          opacity: 1,
        },
      },
      ".mosaic-tile": {
        margin: 0,
      },
      ".mosaic-tile:first-of-type": {
        // make room for splitters - unfortunately this means the background color will show
        // through even if the tile has its own background color set
        gap: 1,
      },
      // The last tile does not need a bottom margin
      ".mosaic-tile:last-child": {
        marginBottom: 0,
      },
      // If there is only one tile in the container there are no splitters and no margin is needed
      ".mosaic-tile:only-child": {
        margin: 0,
      },
      // tile immediately after a row splitter needs 1px margin so the splitter doesn't overlap the tile content
      ".-row + .mosaic-tile": {
        gap: 1,
      },
      // tile immediately after a column splitter needs 1px margin so the splitter doesn't overlap the tile content
      ".-column + .mosaic-tile": {
        gap: 1,
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
        fontSize: 12,
        lineHeight: "30px",
        paddingLeft: 5,
      },
      ".mosaic-split": {
        background: "none !important",
        zIndex: 99,

        ".mosaic-split-line": {
          boxShadow: `0 0 0 1px ${palette.grey.A100}`,
        },
        "&:hover .mosaic-split-line": {
          boxShadow: `0 0 0 1px ${palette.grey.A100}`,
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

    // leaflet GUI styling
    ".leaflet-bar": {
      userSelect: "none",
      backgroundColor: palette.background.paper,
      borderRadius: 4,

      a: {
        lineHeight: 1.2,
        backgroundColor: "transparent",
        color: palette.text.primary,
        borderBottomColor: palette.divider,

        "&:hover": {
          backgroundColor: palette.action.hover,
          color: palette.text.primary,
          borderBottomColor: palette.divider,
        },
        "&:focus": {
          color: palette.text.primary,
        },
        "&:active": {
          color: palette.text.primary,
        },
      },
    },
    ".leaflet-bar a.leaflet-disabled": {
      backgroundColor: palette.action.disabledBackground,
      color: palette.text.disabled,

      "&:hover": {
        backgroundColor: palette.action.disabledBackground,
      },
    },
  },
}));

export default function CssBaseline(props: PropsWithChildren<unknown>): JSX.Element {
  const { classes } = useStyles();

  return <div className={classes.root}>{props.children}</div>;
}
