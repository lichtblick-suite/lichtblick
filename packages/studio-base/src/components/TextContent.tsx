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

import { Link, styled as muiStyled } from "@mui/material";
import { PropsWithChildren, useCallback, useContext, Suspense } from "react";
import { useAsync } from "react-use";
import { CSSProperties } from "styled-components";

import LinkHandlerContext from "@foxglove/studio-base/context/LinkHandlerContext";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

// workaround for ESM in jest: https://github.com/foxglove/studio/issues/1854
const Markdown = React.lazy(async () => await import("react-markdown"));

const TextContentRoot = muiStyled("div")(({ theme }) => ({
  ...theme.typography.body2,
  lineHeight: "1.6",
  backgroundColor: "transparent",
  color: theme.palette.text.secondary,

  "h1, h2, h3, h4, h5, h6": {
    color: theme.palette.text.primary,

    ":first-child": {
      marginTop: 0,
    },
  },
  h1: {
    ...theme.typography.h4,
    marginBottom: theme.spacing(1),
    fontWeight: 500,
  },
  h2: {
    ...theme.typography.h5,
    marginBottom: theme.spacing(1),
    fontWeight: 500,
  },
  h3: {
    ...theme.typography.h6,
    marginBottom: theme.spacing(1),
    color: theme.palette.text.secondary,
    fontWeight: 500,
  },
  h4: {
    ...theme.typography.subtitle1,
    marginBottom: theme.spacing(0.5),
    color: theme.palette.text.secondary,
    fontWeight: 500,
  },
  "h5, h6": {
    ...theme.typography.body2,
    marginBottom: theme.spacing(0.5),
    color: theme.palette.text.secondary,
    fontWeight: 500,
  },
  "ol, ul": {
    paddingLeft: theme.spacing(2.5),
    marginBottom: theme.spacing(2.5),
  },
  li: {
    margin: theme.spacing(0.5, 0),
  },
  "b, strong": {
    fontWeight: "700 !important",
  },
  "p, ul": {
    margin: theme.spacing(1, 0),

    ":only-child": {
      margin: theme.spacing(0.5, 0),
    },
  },
  img: {
    maxWidth: "100%",
  },
  pre: {
    whiteSpace: "pre-wrap",
    fontFamily: fonts.MONOSPACE,
    backgroundColor: theme.palette.action.hover,
    padding: `0 ${theme.spacing(0.5)}`,
    borderRadius: theme.shadows[2],

    code: {
      backgroundColor: "transparent",
      padding: 0,
    },
  },
  code: {
    fontFamily: fonts.MONOSPACE,
    backgroundColor: theme.palette.action.hover,
    borderRadius: "0.2em",
    padding: `0 ${theme.spacing(0.5)}`,
  },
  kbd: {
    display: "inline-flex",
    flex: "none",
    fontFamily: fonts.MONOSPACE,
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.background.default,
    boxShadow: `inset 0 1px 0 ${theme.palette.action.hover}`,
    borderRadius: theme.shape.borderRadius,
    fontSize: theme.typography.body2.fontSize,
    padding: `0 ${theme.spacing(0.5)}`,
    fontWeight: 500,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  table: {
    borderCollapse: "collapse",
    borderSpacing: 0,
    margin: `${theme.spacing(1)} -${theme.spacing(0.5)}`,
    border: `1px solid ${theme.palette.divider}`,
  },
  "td, th": {
    padding: theme.spacing(0.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    borderRight: `1px solid ${theme.palette.divider}`,

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
}));

type Props = {
  style?: CSSProperties;
  allowMarkdownHtml?: boolean;
};

export default function TextContent(
  props: PropsWithChildren<Props>,
): React.ReactElement | ReactNull {
  const { children, style, allowMarkdownHtml } = props;
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

  // workaround for ESM in jest: https://github.com/foxglove/studio/issues/1854
  const { value: rehypeRaw } = useAsync(async () => await import("rehype-raw"));
  if (!rehypeRaw) {
    return ReactNull;
  }

  return (
    <TextContentRoot style={style}>
      {typeof children === "string" ? (
        <Suspense fallback={ReactNull}>
          <Markdown
            rehypePlugins={allowMarkdownHtml === true ? [rehypeRaw.default] : []}
            components={{ a: linkRenderer }}
          >
            {children}
          </Markdown>
        </Suspense>
      ) : (
        children
      )}
    </TextContentRoot>
  );
}
