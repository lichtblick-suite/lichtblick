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

import { Link, makeStyles } from "@fluentui/react";
import { PropsWithChildren, useCallback, useContext } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { CSSProperties } from "styled-components";

import LinkHandlerContext from "@foxglove/studio-base/context/LinkHandlerContext";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const useStyles = makeStyles((theme) => ({
  root: {
    ...theme.fonts.smallPlus,
    lineHeight: "1.6",
    backgroundColor: "transparent",
    color: theme.semanticColors.bodySubtext,

    "h1, h2, h3, h4, h5, h6": {
      color: theme.semanticColors.bodyText,

      ":first-child": {
        marginTop: 0,
      },
    },
    h1: {
      ...theme.fonts.large,
      marginBottom: theme.spacing.s1,
      fontWeight: 500,
    },
    h2: {
      ...theme.fonts.mediumPlus,
      marginBottom: theme.spacing.s1,
      fontWeight: 500,
    },
    h3: {
      ...theme.fonts.medium,
      marginBottom: theme.spacing.s1,
      color: theme.semanticColors.bodySubtext,
      fontWeight: 500,
    },
    h4: {
      ...theme.fonts.smallPlus,
      marginBottom: theme.spacing.s2,
      color: theme.semanticColors.bodySubtext,
      fontWeight: 500,
    },
    "h5, h6": {
      ...theme.fonts.small,
      marginBottom: theme.spacing.s2,
      color: theme.semanticColors.bodySubtext,
      fontWeight: 500,
    },
    "ol, ul": {
      paddingLeft: theme.spacing.l1,
      marginBottom: theme.spacing.m,
    },
    li: {
      margin: `${theme.spacing.s2} 0`,
    },
    "b, strong": {
      fontWeight: "700 !important",
    },
    "p, ul": {
      margin: `${theme.spacing.s1} 0`,

      ":only-child": {
        margin: `${theme.spacing.s2} 0`,
      },
    },
    img: {
      maxWidth: "100%",
    },
    pre: {
      whiteSpace: "pre-wrap",
      fontFamily: fonts.MONOSPACE,
      backgroundColor: theme.semanticColors.bodyBackgroundHovered,
      padding: `0 ${theme.spacing.s2}`,
      borderRadius: theme.effects.roundedCorner2,

      code: {
        backgroundColor: "transparent",
        padding: 0,
      },
    },
    code: {
      fontFamily: fonts.MONOSPACE,
      backgroundColor: theme.semanticColors.bodyBackgroundHovered,
      borderRadius: "0.2em",
      padding: `0 ${theme.spacing.s2}`,
    },
    kbd: {
      display: "inline-flex",
      flex: "none",
      fontFamily: fonts.MONOSPACE,
      color: theme.semanticColors.bodySubtext,
      backgroundColor: theme.semanticColors.bodyBackground,
      boxShadow: `inset 0 1px 0 ${theme.semanticColors.bodyBackgroundHovered}`,
      borderRadius: theme.effects.roundedCorner2,
      fontSize: theme.fonts.small.fontSize,
      padding: `0 ${theme.spacing.s2}`,
      fontWeight: 500,
      minWidth: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    table: {
      borderCollapse: "collapse",
      borderSpacing: 0,
      margin: `${theme.spacing.s1} -${theme.spacing.s2}`,
      border: `1px solid ${theme.semanticColors.bodyFrameDivider}`,
    },
    "td, th": {
      padding: theme.spacing.s2,
      borderBottom: `1px solid ${theme.semanticColors.bodyFrameDivider}`,
      borderRight: `1px solid ${theme.semanticColors.bodyFrameDivider}`,

      ":last-child": {
        borderRight: "none",
      },
    },
    th: {
      whiteSpace: "nowrap",
    },
    tr: {
      ":last-child": {
        "td, th": { borderBottom: "none" },
      },
    },
  },
}));

type Props = {
  style?: CSSProperties;
  allowMarkdownHtml?: boolean;
};

export default function TextContent(props: PropsWithChildren<Props>): React.ReactElement {
  const { children, style, allowMarkdownHtml } = props;
  const classes = useStyles();
  const handleLink = useContext(LinkHandlerContext);

  const linkRenderer = useCallback(
    (linkProps: { href?: string; children: React.ReactNode }) => {
      return (
        <Link
          href={linkProps.href}
          rel="noopener noreferrer"
          onClick={(event) => handleLink(event, linkProps.href ?? "")}
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
