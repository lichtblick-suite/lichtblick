// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useStylesExtensionDetails = makeStyles()((theme) => ({
  backButton: {
    marginLeft: theme.spacing(-1.5),
    marginBottom: theme.spacing(1),
  },
  installButton: {
    minWidth: 100,
  },
}));
