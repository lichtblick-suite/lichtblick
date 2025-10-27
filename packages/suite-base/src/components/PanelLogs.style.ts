// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useStylesPanelLogs = makeStyles()((theme) => ({
  root: {
    background: theme.palette.background.paper,
    borderTop: `1px solid ${theme.palette.divider}`,
    position: "relative",
    display: "flex",
    flexDirection: "column",
    minHeight: 120,
    maxHeight: 600,
  },
  resizeHandle: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    cursor: "ns-resize",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    zIndex: 1,
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    "&:hover .MuiSvgIcon-root": {
      opacity: 1,
    },
  },
  resizeIcon: {
    fontSize: "1rem",
    opacity: 0.3,
    transition: theme.transitions.create("opacity", {
      duration: theme.transitions.duration.short,
    }),
    transform: "rotate(90deg)",
    color: theme.palette.text.secondary,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(1),
    paddingTop: theme.spacing(1.5), // Extra space for resize handle
    paddingBottom: theme.spacing(0.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    flexShrink: 0,
  },
  listContainer: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(0, 1, 1, 1),
  },
  listItem: {
    padding: theme.spacing(1),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
}));
