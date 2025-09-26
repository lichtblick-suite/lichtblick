// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  root: {
    background: theme.palette.background.paper,
    borderTop: `1px solid ${theme.palette.divider}`,
    maxHeight: 200,
    overflowY: "auto",
    padding: theme.spacing(1),
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(1),
  },
}));
