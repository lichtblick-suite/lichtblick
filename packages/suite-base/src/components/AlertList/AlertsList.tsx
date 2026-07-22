// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Dismiss16Regular } from "@fluentui/react-icons";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import {
  Accordion,
  AccordionSummary,
  Divider,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import CopyButton from "@lichtblick/suite-base/components/CopyButton";
import EmptyState from "@lichtblick/suite-base/components/EmptyState";
import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import Stack from "@lichtblick/suite-base/components/Stack";
import {
  getPlayerAlertKey,
  useAlertsActions,
  useAlertsStore,
} from "@lichtblick/suite-base/context/AlertsContext";
import {
  NOTIFICATION_SEVERITY_PRIORITY,
  DetailsType,
  NotificationSeverity,
} from "@lichtblick/suite-base/util/sendNotification";

import { AlertDetails } from "./AlertDetails";
import { AlertIcon } from "./AlertIcon";
import { useStyles } from "./AlertsList.style";
import { selectAlerts, selectDismissedPlayerAlertKeys, selectPlayerAlerts } from "./constants";
import { getAlertCopyText } from "./utils";

export type ListAlert = {
  key: string;
  severity: NotificationSeverity;
  message: string;
  error?: DetailsType;
  tip?: string;
  /** Present for session alerts, which are removed from the store on dismiss. */
  tag?: string;
  /** Present for player alerts, which are hidden by content key on dismiss. */
  playerAlertKey?: string;
};

export function AlertsList(): React.JSX.Element {
  const { t } = useTranslation("alertsList");
  const { classes } = useStyles();
  const playerAlerts = useMessagePipeline(selectPlayerAlerts);
  const sessionAlerts = useAlertsStore(selectAlerts);
  const dismissedPlayerAlertKeys: ReadonlySet<string> = useAlertsStore(
    selectDismissedPlayerAlertKeys,
  );
  const { clearAlert, dismissPlayerAlert } = useAlertsActions();

  const visibleAlerts = useMemo<ListAlert[]>(() => {
    const combined: ListAlert[] = [];
    for (const alert of sessionAlerts) {
      combined.push({
        key: `session:${alert.tag}`,
        severity: alert.severity,
        message: alert.message,
        error: alert.error,
        tip: alert.tip,
        tag: alert.tag,
      });
    }
    for (const alert of playerAlerts ?? []) {
      const playerAlertKey = getPlayerAlertKey(alert);
      if (dismissedPlayerAlertKeys.has(playerAlertKey)) {
        continue;
      }
      combined.push({
        key: `player:${playerAlertKey}`,
        severity: alert.severity,
        message: alert.message,
        error: alert.error,
        tip: alert.tip,
        playerAlertKey,
      });
    }
    return combined.sort(
      (a, b) =>
        NOTIFICATION_SEVERITY_PRIORITY[b.severity] - NOTIFICATION_SEVERITY_PRIORITY[a.severity],
    );
  }, [sessionAlerts, playerAlerts, dismissedPlayerAlertKeys]);

  const handleDismiss = useCallback(
    (alert: ListAlert) => {
      if (alert.tag != undefined) {
        clearAlert(alert.tag);
      } else if (alert.playerAlertKey != undefined) {
        dismissPlayerAlert(alert.playerAlertKey);
      }
    },
    [clearAlert, dismissPlayerAlert],
  );

  if (visibleAlerts.length === 0) {
    return <EmptyState>{t("noAlertsFound")}</EmptyState>;
  }

  return (
    <Stack fullHeight flex="auto" overflow="auto">
      {visibleAlerts.map((alert) => (
        <Accordion
          className={classes.accordion}
          key={alert.key}
          slotProps={{ transition: { unmountOnExit: true } }}
          defaultExpanded
        >
          <div className={classes.rowHeader}>
            <AccordionSummary
              className={classes.accordionSummary}
              expandIcon={<ArrowDropDownIcon />}
              title={alert.message}
            >
              <AlertIcon severity={alert.severity} />
              <Typography variant="inherit" noWrap>
                {alert.message}
              </Typography>
            </AccordionSummary>
            <div className={classes.rowActions}>
              <CopyButton
                iconSize="small"
                size="small"
                color="inherit"
                aria-label={t("copyDetails")}
                getText={() => getAlertCopyText(alert)}
              />
              <Tooltip arrow title={t("dismiss")}>
                <IconButton
                  size="small"
                  color="inherit"
                  aria-label={t("dismiss")}
                  onClick={() => {
                    handleDismiss(alert);
                  }}
                >
                  <Dismiss16Regular />
                </IconButton>
              </Tooltip>
            </div>
          </div>
          <Divider />
          <AlertDetails details={alert.error} tip={alert.tip} />
        </Accordion>
      ))}
    </Stack>
  );
}
