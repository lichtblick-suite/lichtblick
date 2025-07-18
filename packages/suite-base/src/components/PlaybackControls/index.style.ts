// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    padding: theme.spacing(0.5, 1, 1, 1),
    position: "relative",
    backgroundColor: theme.palette.background.paper,
    borderTop: `1px solid ${theme.palette.divider}`,
    zIndex: 100000,
    overflowX: "auto",
  },
  scrubberWrapper: {
    position: "sticky",
    top: 0,
    right: 0,
    left: 0,
  },
  disabled: {
    opacity: theme.palette.action.disabledOpacity,
  },
  popper: {
    "&[data-popper-placement*=top] .MuiTooltip-tooltip": {
      margin: theme.spacing(0.5, 0.5, 0.75),
    },
  },
  dataSourceInfoButton: {
    cursor: "default",
  },
}));
