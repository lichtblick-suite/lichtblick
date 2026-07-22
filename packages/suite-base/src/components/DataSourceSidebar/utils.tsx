// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { NotificationSeverity } from "@lichtblick/suite-base/util/sendNotification";

import { useAlertBadgeStyles } from "./DataSourceSidebar.style";

export function AlertBadge({
  count,
  severity = "error",
}: Readonly<{
  count: number;
  severity?: NotificationSeverity;
}>): React.JSX.Element {
  const { classes } = useAlertBadgeStyles({ severity });
  return <span className={classes.badge}>{count}</span>;
}
