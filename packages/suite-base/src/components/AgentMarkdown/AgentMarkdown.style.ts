// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "tss-react/mui";

import { customTypography } from "@lichtblick/theme";

export const useStyles = makeStyles()((theme) => ({
  markdown: {
    fontFamily: theme.typography.body2.fontFamily,
    fontSize: theme.typography.body2.fontSize,
    lineHeight: theme.typography.body2.lineHeight,

    "p, ul, ol, pre, blockquote, h1, h2, h3, h4, h5, h6, hr": {
      margin: theme.spacing(0.75, 0),

      "&:first-child": {
        marginTop: 0,
      },
      "&:last-child": {
        marginBottom: 0,
      },
    },
    // Browser default heading sizes are wildly oversized inside a narrow sidebar bubble. Keep the
    // hierarchy legible through weight and modest steps rather than scale.
    "h1, h2, h3, h4, h5, h6": {
      marginTop: theme.spacing(1.5),
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h1: { fontSize: "1.15em" },
    h2: { fontSize: "1.1em" },
    h3: { fontSize: "1.05em" },
    "h4, h5, h6": { fontSize: "1em" },
    "ul, ol": {
      paddingLeft: theme.spacing(2.5),
    },
    li: {
      "& > p": {
        margin: 0,
      },
      "& + li": {
        marginTop: theme.spacing(0.25),
      },
    },
    // Nested lists would otherwise inherit the block margin and look detached from their parent.
    "li > ul, li > ol": {
      margin: theme.spacing(0.25, 0),
    },
    // GFM task lists render a checkbox as the item content, so the bullet is redundant.
    "li.task-list-item": {
      listStyle: "none",
      marginLeft: theme.spacing(-2),

      "& > input[type='checkbox']": {
        marginRight: theme.spacing(0.75),
        verticalAlign: "middle",
      },
    },
    pre: {
      maxWidth: "100%",
      overflowX: "auto",
      padding: theme.spacing(1),
      backgroundColor: theme.palette.background.default,
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: theme.shape.borderRadius,
    },
    code: {
      fontFamily: customTypography.fontMonospace,
      fontSize: "0.9em",
      padding: theme.spacing(0, 0.25),
      backgroundColor: theme.palette.action.selected,
      borderRadius: theme.shape.borderRadius,
      // Topic paths and message paths are long and have no spaces; without this they force the
      // bubble wider than the sidebar.
      overflowWrap: "anywhere",
    },
    "pre code": {
      padding: 0,
      backgroundColor: "transparent",
      // Inside a scrollable pre, breaking mid-token would corrupt the code's meaning.
      overflowWrap: "normal",
      whiteSpace: "pre",
    },
    blockquote: {
      paddingLeft: theme.spacing(1),
      borderLeft: `2px solid ${theme.palette.divider}`,
      color: theme.palette.text.secondary,
    },
    hr: {
      border: "none",
      borderTop: `1px solid ${theme.palette.divider}`,
    },
    table: {
      borderCollapse: "collapse",
      // Let content decide the width; the wrapper scrolls when it exceeds the bubble.
      width: "max-content",
      maxWidth: "none",
    },
    "th, td": {
      padding: theme.spacing(0.375, 0.75),
      border: `1px solid ${theme.palette.divider}`,
      textAlign: "left",
      verticalAlign: "top",
    },
    th: {
      fontWeight: 600,
      backgroundColor: theme.palette.action.selected,
      whiteSpace: "nowrap",
    },
    a: {
      color: "inherit",
      textDecoration: "underline",
    },
  },
  tableScroll: {
    margin: theme.spacing(0.75, 0),
    maxWidth: "100%",
    overflowX: "auto",

    "&:first-child": {
      marginTop: 0,
    },
    "&:last-child": {
      marginBottom: 0,
    },
  },
  markdownImage: {
    display: "block",
    maxWidth: "100%",
    height: "auto",
    margin: theme.spacing(0.75, 0),
  },
  imagePlaceholder: {
    maxWidth: "100%",
    overflowWrap: "anywhere",
    textAlign: "left",
    textTransform: "none",
  },
}));
