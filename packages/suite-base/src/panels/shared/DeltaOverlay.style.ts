// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

import { customTypography } from "@lichtblick/theme";

export const useDeltaOverlayStyles = makeStyles()((theme) => ({
  root: {
    position: "relative",
    pointerEvents: "auto",
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[4],
    padding: theme.spacing(1, 3.5, 1, 1.5),
    opacity: 0.95,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "auto max-content max-content max-content",
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(0.5),
    alignItems: "center",
    fontFamily: customTypography.fontMonospace,
    fontSize: theme.typography.caption.fontSize,
    lineHeight: theme.typography.caption.lineHeight,
  },
  columnHeader: {
    opacity: 0.8,
    whiteSpace: "nowrap",
    textAlign: "right",
  },
  markerLabelCell: {
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
    marginRight: theme.spacing(0.75),
    flexShrink: 0,
  },
  rowLabel: {
    opacity: 0.9,
    whiteSpace: "nowrap",
  },
  value: {
    fontWeight: 600,
    whiteSpace: "nowrap",
    textAlign: "right",
  },
  removeButton: {
    padding: theme.spacing(0.25),
    marginLeft: theme.spacing(0.5),
  },
  closeButton: {
    position: "absolute",
    top: theme.spacing(0.5),
    right: theme.spacing(0.5),
    padding: theme.spacing(0.25),
  },
}));
