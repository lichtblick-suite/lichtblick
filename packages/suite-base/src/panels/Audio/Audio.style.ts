// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    userSelect: "none",
  },
  statusText: {
    color: theme.palette.text.secondary,
    textAlign: "center",
    fontSize: "0.875rem",
  },
  topicText: {
    color: theme.palette.text.primary,
    fontFamily: "monospace",
    fontSize: "0.8rem",
    textAlign: "center",
    wordBreak: "break-all",
  },
  encodingText: {
    color: theme.palette.text.secondary,
    textAlign: "center",
    fontSize: "0.8rem",
  },
  errorText: {
    color: theme.palette.error.main,
    textAlign: "center",
    fontSize: "0.875rem",
    maxWidth: "100%",
    wordBreak: "break-word",
  },
  icon: {
    fontSize: "3rem",
    color: theme.palette.text.secondary,
  },
  iconPlaying: {
    color: theme.palette.primary.main,
  },
}));
