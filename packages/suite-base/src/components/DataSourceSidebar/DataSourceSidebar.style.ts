// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

import { NotificationSeverity } from "@lichtblick/suite-base/util/sendNotification";

export const useStyles = makeStyles()((theme) => ({
  tabContent: {
    flex: "auto",
  },
  tab: {
    minHeight: 30,
    minWidth: theme.spacing(8),
    padding: theme.spacing(0, 1.5),
    color: theme.palette.text.secondary,
    fontSize: "0.6875rem",

    "&.Mui-selected": {
      color: theme.palette.text.primary,
    },
  },
  tabs: {
    minHeight: "auto",

    "& .MuiTabs-indicator": {
      transform: "scaleX(0.5)",
      height: 2,
    },
  },
}));

export const useAlertBadgeStyles = makeStyles<{ severity: NotificationSeverity }>()(
  (theme, { severity }) => {
    const paletteColor = {
      error: theme.palette.error,
      warn: theme.palette.warning,
      info: theme.palette.info,
    }[severity];
    return {
      badge: {
        backgroundColor: paletteColor.main,
        fontSize: theme.typography.caption.fontSize,
        color: paletteColor.contrastText,
        padding: theme.spacing(0.125, 0.75),
        borderRadius: 8,
      },
    };
  },
);
