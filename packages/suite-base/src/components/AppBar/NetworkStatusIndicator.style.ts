// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  indicator: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.borderRadius,
    fontSize: "0.875rem",
    minWidth: 0,
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
  },
  icon: {
    fontSize: "1rem",
  },
  tooltipContent: {
    maxWidth: 300,
  },
  tooltipTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(0.5),
  },
}));
