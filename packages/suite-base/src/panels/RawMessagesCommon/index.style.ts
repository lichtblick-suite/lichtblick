// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { makeStyles } from "tss-react/mui";

import { customTypography } from "@lichtblick/theme";

export const useStylesRawMessages = makeStyles()((theme) => ({
  topic: {
    fontFamily: theme.typography.body1.fontFamily,
    fontFeatureSettings: `${customTypography.fontFeatureSettings}, "zero"`,
  },
  hoverObserver: {
    display: "inline-flex",
    alignItems: "center",
  },
}));

export const useStylesRawMessagesVirtual = makeStyles()((theme) => ({
  topic: {
    fontFamily: theme.typography.body1.fontFamily,
    fontFeatureSettings: `${customTypography.fontFeatureSettings}, "zero"`,
  },
  hoverObserver: {
    display: "inline-flex",
    alignItems: "center",
  },
}));

export const useStylesDiffSpan = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(0, 0.5),
    textDecoration: "inherit",
    whiteSpace: "pre-line",
  },
}));

export const useStylesDiffStats = makeStyles()((theme) => ({
  diff: {
    float: "right",
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
    marginRight: theme.spacing(0.75),
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(0.25),
    padding: theme.spacing(0, 0.75),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.paper,
  },
  changeIndicator: {
    display: "inline-block",
    width: theme.spacing(0.75),
    height: theme.spacing(0.75),
    borderRadius: "50%",
    backgroundColor: theme.palette.warning.main,
  },
}));

export const useStylesMetadata = makeStyles()((theme) => ({
  button: {
    padding: theme.spacing(0.125),

    ".MuiSvgIcon-root": {
      fontSize: `${theme.typography.pxToRem(16)} !important`,
    },
    ".MuiButton-startIcon": {
      marginRight: theme.spacing(0.5),
    },
    "&:hover": {
      backgroundColor: "transparent",
    },
  },
}));

export const useStylesToolbar = makeStyles()((theme) => ({
  toolbar: {
    paddingBlock: 0,
    gap: theme.spacing(0.25),
  },
  iconButton: {
    padding: theme.spacing(0.25),

    "&.Mui-selected": {
      color: theme.palette.primary.main,
      backgroundColor: theme.palette.action.selected,
    },
  },
  diffOptions: {
    borderTop: `1px solid ${theme.palette.background.default}`,
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(0.25, 0.75),
    paddingInlineEnd: theme.spacing(6.75),
    gap: theme.spacing(0.25),
    display: "flex",
  },
}));

export const useStylesValue = makeStyles()({
  // always hidden, just used to keep space and prevent resizing on hover
  placeholderActionContainer: {
    alignItems: "inherit",
    display: "inherit",
    gap: "inherit",
    visibility: "hidden",
  },
});

export const useStylesVirtualizedTree = makeStyles()((theme) => ({
  container: {
    overflow: "auto",
    contain: "strict",
    height: "100%",
    width: "100%",
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    padding: "2px 0",
    fontFamily: theme.typography.body1.fontFamily,
    fontFeatureSettings: `${customTypography.fontFeatureSettings}, "zero"`,
    fontSize: "inherit",
    lineHeight: 1.4,
  },
  expandButton: {
    cursor: "pointer",
    userSelect: "none",
    minWidth: 12,
    marginRight: theme.spacing(0.5),
    color: theme.palette.text.secondary,
  },
  key: {
    color: theme.palette.primary.main,
    marginRight: theme.spacing(0.5),
  },
  colon: {
    marginRight: theme.spacing(0.5),
  },
  value: {
    color: theme.palette.text.primary,
    wordBreak: "break-word",
    overflowWrap: "break-word",
  },
  string: {
    color: theme.palette.success.main,
  },
  number: {
    color: theme.palette.info.main,
  },
  boolean: {
    color: theme.palette.warning.main,
  },
  null: {
    color: theme.palette.text.disabled,
  },
  objectLabel: {
    color: theme.palette.text.secondary,
    fontStyle: "italic",
  },
}));
