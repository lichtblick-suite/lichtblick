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

const useStyles = makeStyles((theme) => ({
  root: {
    ...theme.fonts.smallPlus,
    lineHeight: "1.4",
    backgroundColor: "transparent",
    color: theme.semanticColors.bodySubtext,

    "h1, h2, h3, h4, h5, h6": {
      color: theme.semanticColors.bodyText,

      ":first-child": {
        marginTop: 0,
      },
    },
    h1: {
      ...theme.fonts.xxLarge,
      marginBottom: theme.spacing.s1,
      fontWeight: 500,
    },
    h2: {
      ...theme.fonts.xLarge,
      marginBottom: theme.spacing.s1,
      fontWeight: 500,
    },
    h3: {
      ...theme.fonts.large,
      marginBottom: theme.spacing.s1,
      color: theme.palette.neutralLight,
      fontWeight: 500,
    },
    "h4, h5, h6": {
      ...theme.fonts.mediumPlus,
      marginBottom: theme.spacing.s2,
      color: theme.palette.neutralLight,
      fontWeight: 500,
      fontStyle: "italic",
    },
    ul: {
      lineHeight: "1.5",
      listStylePosition: "outside",
      listStyleType: "disc",
      marginLeft: theme.spacing.s1,
      marginBottom: theme.spacing.m,
    },
    "b, strong": {
      fontWeight: "700 !important",
    },
    "p, ul": {
      margin: `${theme.spacing.s1} 0`,
    },
    "td, th": {
      padding: theme.spacing.s2,
      verticalAlign: "middle",
    },
    img: {
      maxWidth: "100%",
    },
    pre: {
      whiteSpace: "pre-wrap",
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
