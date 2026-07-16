// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ErrorCircle16Regular, Info16Regular, Warning16Regular } from "@fluentui/react-icons";
import { useTheme } from "@mui/material";

import { NotificationSeverity } from "@lichtblick/suite-base/util/sendNotification";

import { useStyles } from "./AlertsList.style";

export function AlertIcon({ severity }: { severity: NotificationSeverity }): React.JSX.Element {
  const { palette } = useTheme();
  const { classes } = useStyles();

  switch (severity) {
    case "warn":
      return <Warning16Regular className={classes.icon} primaryFill={palette.warning.main} />;
    case "error":
      return <ErrorCircle16Regular className={classes.icon} primaryFill={palette.error.main} />;
    case "info":
      return <Info16Regular className={classes.icon} primaryFill={palette.info.main} />;
    default:
      return <></>;
  }
}
