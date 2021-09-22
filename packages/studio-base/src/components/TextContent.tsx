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

import { Link, mergeStyleSets } from "@fluentui/react";
import { PropsWithChildren, useCallback, useContext } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { CSSProperties } from "styled-components";

import LinkHandlerContext from "@foxglove/studio-base/context/LinkHandlerContext";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const classes = mergeStyleSets({
  root: {
    backgroundColor: "transparent",

    "h1, h2, h3, h4, h5, h6": {
      fontWeight: "normal",
      lineHeight: "1.4",
    },
    h1: {
      fontSize: "2em",
      marginBottom: "0.5em",
      lineHeight: "1.2",

      ":first-of-type": {
        marginTop: 0,
      },
    },
    h2: {
      fontSize: "1.3em",
      marginBottom: "0.25em",
    },
    h3: {
      fontSize: "1.1em",
      marginBottom: "0.25em",
      color: colors.TEXT_MUTED,
    },
    "h4, h5, h6": {
      marginBottom: "0.25em",
      color: colors.TEXT_MUTED,
      fontStyle: "italic",
    },
    ul: {
      listStylePosition: "outside",
      listStyleType: "disc",
      marginLeft: "1.5em",
      marginBottom: "1em",
    },
    "p, ul": {
      ":last-child": {
        marginBottom: "0",
      },
    },
    "td, th": {
      padding: "0.5em",
      verticalAlign: "middle",
    },
    img: {
      maxWidth: "100%",
    },
    pre: {
      whiteSpace: "pre-wrap",
    },
  },
});

type Props = {
  style?: CSSProperties;
  allowMarkdownHtml?: boolean;
};

export default function TextContent(props: PropsWithChildren<Props>): React.ReactElement {
  const { children, style, allowMarkdownHtml } = props;

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
