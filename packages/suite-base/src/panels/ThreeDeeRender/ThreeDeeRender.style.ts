// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "tss-react/mui";

import { fontMonospace } from "@lichtblick/theme";

export const useStyles = makeStyles()(() => ({
  loadingTransforms: {
    position: "absolute",
    bottom: "10px",
    left: "10px",
    padding: "8px 12px",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    color: "white",
    borderRadius: "4px",
    fontSize: "12px",
    fontFamily: fontMonospace,
    zIndex: 1000,
  },
}));
