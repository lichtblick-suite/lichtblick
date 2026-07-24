// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import {
  AlertsContextStore,
  getAlertKey,
  useAlertsStore,
} from "@lichtblick/suite-base/context/AlertsContext";
import { PlayerAlert } from "@lichtblick/suite-base/players/types";
import {
  NOTIFICATION_SEVERITY_PRIORITY,
  NotificationSeverity,
} from "@lichtblick/suite-base/util/sendNotification";

const EMPTY_PLAYER_ALERTS: readonly PlayerAlert[] = [];
const selectPlayerAlerts = ({ playerState }: MessagePipelineContext) => playerState.alerts;
const selectSessionAlerts = (store: AlertsContextStore) => store.alerts;
const selectDismissedPlayerAlertKeys = (store: AlertsContextStore) =>
  store.dismissedPlayerAlertKeys;

export default function useAlertCount(): {
  playerAlerts: readonly PlayerAlert[];
  sessionAlerts: AlertsContextStore["alerts"];
  alertCount: number;
  highestSeverity: NotificationSeverity | undefined;
} {
  const allPlayerAlerts = useMessagePipeline(selectPlayerAlerts) ?? EMPTY_PLAYER_ALERTS;
  const sessionAlerts = useAlertsStore(selectSessionAlerts);
  const dismissedPlayerAlertKeys = useAlertsStore(selectDismissedPlayerAlertKeys);

  const playerAlerts = useMemo(
    () => allPlayerAlerts.filter((alert) => !dismissedPlayerAlertKeys.has(getAlertKey(alert))),
    [allPlayerAlerts, dismissedPlayerAlertKeys],
  );

  const highestSeverity = useMemo<NotificationSeverity | undefined>(() => {
    let highest: NotificationSeverity | undefined;
    for (const alert of [...playerAlerts, ...sessionAlerts]) {
      if (
        highest == undefined ||
        NOTIFICATION_SEVERITY_PRIORITY[alert.severity] > NOTIFICATION_SEVERITY_PRIORITY[highest]
      ) {
        highest = alert.severity;
      }
    }
    return highest;
  }, [playerAlerts, sessionAlerts]);

  return {
    playerAlerts,
    sessionAlerts,
    alertCount: playerAlerts.length + sessionAlerts.length,
    highestSeverity,
  };
}
