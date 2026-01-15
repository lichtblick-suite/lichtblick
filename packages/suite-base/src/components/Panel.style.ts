// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { makeStyles } from "tss-react/mui";

import { customTypography } from "@lichtblick/theme";

export const useStyles = makeStyles()((theme) => ({
  perfInfo: {
    position: "absolute",
    bottom: 2,
    left: 3,
    whiteSpace: "pre-line",
    fontSize: "0.75em",
    fontFeatureSettings: `${customTypography.fontFeatureSettings}, 'zero'`,
    opacity: 0.7,
    userSelect: "none",
    mixBlendMode: "difference",
  },
  tabCount: {
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    display: "flex",
    inset: 0,
    textAlign: "center",
    letterSpacing: "-0.125em",
    // Totally random numbers here to get the text to fit inside the icon
    paddingTop: 1,
    paddingLeft: 5,
    paddingRight: 11,
    fontSize: `${theme.typography.subtitle2.fontSize} !important`,
    fontWeight: 600,
  },
}));
