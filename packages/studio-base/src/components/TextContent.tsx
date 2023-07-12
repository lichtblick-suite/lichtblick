// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Link } from "@mui/material";
import { PropsWithChildren, CSSProperties, useCallback, useContext } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { makeStyles } from "tss-react/mui";

import LinkHandlerContext from "@foxglove/studio-base/context/LinkHandlerContext";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const useStyles = makeStyles()(({ palette, shape, spacing, typography, shadows }) => {
  return {
    root: {
      fontFamily: typography.body2.fontFamily,
      fontSize: typography.body2.fontSize,
      fontWeight: typography.body2.fontWeight,
      lineHeight: typography.body2.lineHeight,
      backgroundColor: "transparent",
      color: palette.text.secondary,

      "h1, h2, h3, h4, h5, h6": {
        color: palette.text.primary,

        "&:first-child": { marginTop: 0 },
      },
      h1: {
        fontFamily: typography.h4.fontFamily,
        fontSize: typography.h4.fontSize,
        lineHeight: typography.h4.lineHeight,
        marginBottom: spacing(1),
        fontWeight: 500,
      },
      h2: {
        fontFamily: typography.h5.fontFamily,
        fontSize: typography.h5.fontSize,
        lineHeight: typography.h5.lineHeight,
        marginBottom: spacing(1),
        fontWeight: 500,
      },
      h3: {
        fontFamily: typography.h6.fontFamily,
        fontSize: typography.h6.fontSize,
        lineHeight: typography.h6.lineHeight,
        marginBottom: spacing(1),
        color: palette.text.secondary,
        fontWeight: 500,
      },
      h4: {
        fontFamily: typography.subtitle1.fontFamily,
        fontSize: typography.subtitle1.fontSize,
        lineHeight: typography.subtitle1.lineHeight,
        marginBottom: spacing(0.5),
        color: palette.text.secondary,
        fontWeight: 500,
      },
      "h5, h6": {
        fontFamily: typography.body1.fontFamily,
        fontSize: typography.body1.fontSize,
        lineHeight: typography.body1.lineHeight,
        marginBottom: spacing(0.5),
        color: palette.text.secondary,
        fontWeight: 500,
      },
      "ol, ul": {
        paddingLeft: spacing(2.5),
        marginBottom: spacing(2.5),
      },
      li: {
        margin: spacing(0.5, 0),
      },
      "b, strong": {
        fontWeight: "700 !important",
      },
      "p, ul": {
        margin: spacing(1, 0),

        "&:only-child": {
          margin: spacing(0.5, 0),
        },
      },
      img: {
        maxWidth: "100%",
      },
      pre: {
        whiteSpace: "pre-wrap",
        fontFamily: fonts.MONOSPACE,
        backgroundColor: palette.action.hover,
        padding: spacing(0, 0.5),
        borderRadius: shadows[2],

        code: {
          backgroundColor: "transparent",
          padding: 0,
        },
      },
      code: {
        fontFamily: fonts.MONOSPACE,
        backgroundColor: palette.action.hover,
        borderRadius: "0.2em",
        padding: spacing(0, 0.5),
      },
      kbd: {
        display: "inline-flex",
        flex: "none",
        fontFamily: fonts.MONOSPACE,
        color: palette.text.secondary,
        backgroundColor: palette.background.default,
        boxShadow: `inset 0 1px 0 ${palette.action.hover}`,
        borderRadius: shape.borderRadius,
        fontSize: typography.body2.fontSize,
        padding: spacing(0, 0.5),
        fontWeight: 500,
        minWidth: 20,
        alignItems: "center",
        justifyContent: "center",
      },
      table: {
        borderCollapse: "collapse",
        borderSpacing: 0,
        margin: spacing(1, -0.5),
        border: `1px solid ${palette.divider}`,
      },
      "td, th": {
        padding: spacing(0.5),
        borderBottom: `1px solid ${palette.divider}`,
        borderRight: `1px solid ${palette.divider}`,

        "&:last-child": {
          borderRight: "none",
        },
      },
      th: {
        whiteSpace: "nowrap",
      },
      tr: {
        "&:last-child": {
          "td, th": { borderBottom: "none" },
        },
      },
    },
  };
});

type Props = {
  style?: CSSProperties;
  allowMarkdownHtml?: boolean;
};

export default function TextContent(
  props: PropsWithChildren<Props>,
): React.ReactElement | ReactNull {
  const { children, style, allowMarkdownHtml } = props;
  const { classes } = useStyles();
  const handleLink = useContext(LinkHandlerContext);

  const linkRenderer = useCallback(
    (linkProps: { href?: string; children: React.ReactNode }) => {
      return (
        <Link
          color="primary"
          underline="hover"
          variant="inherit"
          href={linkProps.href}
          rel="noopener noreferrer"
          onClick={(event) => handleLink(event, linkProps.href ?? "")}
          target="_blank"
        >
          {linkProps.children}
        </Link>
      );
    },
    [handleLink],
  );

  return (
    <div className={classes.root} style={style}>
      {typeof children === "string" ? (
        <Markdown
          rehypePlugins={allowMarkdownHtml === true ? [rehypeRaw] : []}
          components={{ a: linkRenderer }}
        >
          {children}
        </Markdown>
      ) : (
        children
      )}
    </div>
  );
}
