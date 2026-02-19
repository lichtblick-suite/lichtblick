// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()(() => ({
  logsBadge: {
    "& .MuiBadge-dot": {
      minWidth: 8,
      height: 8,
      borderRadius: "50%",
    },
  },
}));
