// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  fileTypeText: {
    marginBottom: theme.spacing(2),
  },
  fileNamesText: {
    marginBottom: theme.spacing(3),
    color: theme.palette.text.secondary,
  },
  questionText: {
    marginBottom: theme.spacing(2),
  },
}));
