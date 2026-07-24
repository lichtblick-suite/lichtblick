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
  getAlertKey,
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

type GroupedAlert = ListAlert & {
  /** Number of identical alerts (by severity+message) collapsed into this entry. */
  count: number;
  /** All session tags in this group (for batch dismiss). */
  tags: string[];
  /** All player alert keys in this group (for batch dismiss). */
  playerAlertKeys: string[];
};

export function AlertsList(): React.JSX.Element {
  const { t } = useTranslation("alertsList");
  const { classes } = useStyles();
  const playerAlerts = useMessagePipeline(selectPlayerAlerts);
  const sessionAlerts = useAlertsStore(selectAlerts);
  const dismissedPlayerAlertKeys: ReadonlySet<string> = useAlertsStore(
    selectDismissedPlayerAlertKeys,
  );
  const { dismissSessionAlert: dismissAlert, dismissPlayerAlert } = useAlertsActions();

  const groupedAlerts = useMemo<GroupedAlert[]>(() => {
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
      const playerAlertKey = getAlertKey(alert);
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

    // Group by content key (severity::message)
    const groups = new Map<string, GroupedAlert>();
    for (const alert of combined) {
      const contentKey = getAlertKey(alert);
      const existing = groups.get(contentKey);
      if (existing) {
        existing.count += 1;
        if (alert.tag != undefined) {
          existing.tags.push(alert.tag);
        }
        if (
          alert.playerAlertKey != undefined &&
          !existing.playerAlertKeys.includes(alert.playerAlertKey)
        ) {
          existing.playerAlertKeys.push(alert.playerAlertKey);
        }
      } else {
        groups.set(contentKey, {
          ...alert,
          key: contentKey,
          count: 1,
          tags: alert.tag != undefined ? [alert.tag] : [],
          playerAlertKeys: alert.playerAlertKey != undefined ? [alert.playerAlertKey] : [],
        });
      }
    }

    return Array.from(groups.values()).sort(
      (a, b) =>
        NOTIFICATION_SEVERITY_PRIORITY[b.severity] - NOTIFICATION_SEVERITY_PRIORITY[a.severity],
    );
  }, [sessionAlerts, playerAlerts, dismissedPlayerAlertKeys]);

  const handleDismiss = useCallback(
    (alert: GroupedAlert) => {
      for (const tag of alert.tags) {
        dismissAlert(tag);
      }
      for (const key of alert.playerAlertKeys) {
        dismissPlayerAlert(key);
      }
    },
    [dismissAlert, dismissPlayerAlert],
  );

  if (groupedAlerts.length === 0) {
    return <EmptyState>{t("noAlertsFound")}</EmptyState>;
  }

  return (
    <Stack fullHeight flex="auto" overflow="auto">
      {groupedAlerts.map((alert) => (
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
              {alert.count > 1 && (
                <Typography className={classes.countBadge} variant="caption">
                  {alert.count}x
                </Typography>
              )}
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
