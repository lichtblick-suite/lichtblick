// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

import { customTypography } from "@lichtblick/theme";

export const useDeltaOverlayStyles = makeStyles()((theme) => ({
  root: {
    pointerEvents: "auto",
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[4],
    padding: theme.spacing(1),
  },
  grid: {
    display: "grid",
    columnGap: theme.spacing(1.5),
    rowGap: theme.spacing(0.25),
    alignItems: "center",
    fontFamily: customTypography.fontMonospace,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
  },
  rowLabel: {
    opacity: 0.9,
    whiteSpace: "nowrap",
  },
  value: {
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  colorIcon: {
    height: 12,
    width: 12,
    flexShrink: 0,
  },
  removeButton: {
    minWidth: "unset",
    padding: theme.spacing(0.25),
  },
}));
