// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/* eslint-disable tss-unused-classes/unused-classes */

import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    padding: theme.spacing(1.5, 1, 1.5, 2),
    gap: theme.spacing(1),
    backgroundColor: theme.palette.action.hover,
    position: "sticky",
    alignItems: "center",
    bottom: 0,

    "&:hover": {
      backgroundColor: theme.palette.action.focus,
    },
  },
  title: {
    maxWidth: 280,
  },
}));
