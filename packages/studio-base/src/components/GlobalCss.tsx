// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mergeStyles, useTheme } from "@fluentui/react";

import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const mosaicStyles = () =>
  mergeStyles({
    ":global(.mosaic)": {
      ".mosaic-root": {
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
      },
      ".mosaic-tile": {
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
        background: "none",
        zIndex: 99,

        ".mosaic-split-line": {
          boxShadow: `0 0 0 1px ${colors.DARK3}`,
        },
        ":hover .mosaic-split-line": {
          boxShadow: `0 0 0 1px ${colors.GREY}`,
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
      ".mosaic-window-controls": {
        ".separator": {
          borderLeft: `1px solid ${colors.DIVIDER}`,
        },
        ".pt-button": {
          outline: "none",
          cursor: "pointer",
          backgroundColor: "transparent",
          borderColor: "transparent",
          color: colors.TEXT_CONTROL,

          ":active, :focus": {
            outline: "none",
          },

          ":before": {
            cursor: "pointer",
            backgroundColor: "transparent",
            borderColor: "transparent",
            color: colors.TEXT_CONTROL,
          },
          ":hover:before": {
            color: colors.TEXT_CONTROL_HOVER,
          },
        },
      },
      ".drop-target-container .drop-target": {
        backgroundColor: colors.TEXT_DISABLED,
        border: `2px solid ${colors.TEXT_MUTED}`,
      },
    },
  });

/** GlobalCss component configures html, body, and #root with theme elements */
export default function GlobalCss(): JSX.Element {
  const theme = useTheme();

  mosaicStyles();

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
