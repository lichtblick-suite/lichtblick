// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { alpha } from "@mui/material";
import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  button: {
    font: "inherit",
    height: theme.spacing(4),
    fontSize: theme.typography.body2.fontSize,
    color: theme.palette.common.white,
    borderColor: alpha(theme.palette.common.white, 0.24),

    "&:hover": {
      borderColor: alpha(theme.palette.common.white, 0.4),
      backgroundColor: alpha(theme.palette.common.white, 0.08),
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
