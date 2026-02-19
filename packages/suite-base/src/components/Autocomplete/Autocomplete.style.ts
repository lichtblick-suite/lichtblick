// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  inputError: {
    input: {
      color: theme.palette.error.main,
    },
  },
  root: {
    "& .MuiAutocomplete-endAdornment": {
      top: "50%",
    },
    "& .MuiAutocomplete-clearIndicator": {
      top: "50% !important",
    },
  },
}));
