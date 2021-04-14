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

import { PropsWithChildren, useCallback, useContext } from "react";
import ReactMarkdown from "react-markdown/with-html";
import { CSSProperties } from "styled-components";

import LinkHandlerContext from "@foxglove-studio/app/context/LinkHandlerContext";

import styles from "./TextContent.module.scss";

type Props = {
  style?: CSSProperties;
  allowDangerousHtml?: boolean;
};

export default function TextContent(props: PropsWithChildren<Props>): React.ReactElement {
  const { children, style, allowDangerousHtml } = props;

  const handleLink = useContext(LinkHandlerContext);

  const linkRenderer = useCallback(
    (linkProps: { href: string; children: React.ReactNode }) => {
      return (
        <a
          href={linkProps.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => handleLink(event, linkProps.href)}
        >
          {linkProps.children}
        </a>
      );
    },
    [handleLink],
  );

  return (
    <div className={styles.root} style={style}>
      {typeof children === "string" ? (
        <ReactMarkdown
          source={children}
          renderers={{ link: linkRenderer }}
          allowDangerousHtml={allowDangerousHtml}
        />
      ) : (
        children
      )}
    </div>
  );
}
