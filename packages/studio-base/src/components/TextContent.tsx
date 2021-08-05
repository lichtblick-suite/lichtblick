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

import { Link } from "@fluentui/react";
import { PropsWithChildren, useCallback, useContext } from "react";
import Markdown, { PluggableList } from "react-markdown";
import rehypeRaw from "rehype-raw";
import { CSSProperties } from "styled-components";

import LinkHandlerContext from "@foxglove/studio-base/context/LinkHandlerContext";

import styles from "./TextContent.module.scss";

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

  const rehypePlugins: PluggableList = [];
  if (allowMarkdownHtml === true) {
    rehypePlugins.push(rehypeRaw);
  }

  return (
    <div className={styles.root} style={style}>
      {typeof children === "string" ? (
        <Markdown rehypePlugins={rehypePlugins} components={{ a: linkRenderer }}>
          {children}
        </Markdown>
      ) : (
        children
      )}
    </div>
  );
}
