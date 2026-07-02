// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  button: {
    font: "inherit",
    height: theme.spacing(4),
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.common.white,
    borderColor: "rgba(255, 255, 255, 0.24)",

    "&:hover": {
      borderColor: "rgba(255, 255, 255, 0.4)",
      backgroundColor: "rgba(255, 255, 255, 0.08)",
    },
  },
  buttonLabel: {
    maxWidth: 160,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  menuList: {
    minWidth: 220,
    maxWidth: 280,
  },
  menuText: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
}));
