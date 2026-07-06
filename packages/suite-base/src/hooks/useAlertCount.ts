// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { AlertsContextStore, useAlertsStore } from "@lichtblick/suite-base/context/AlertsContext";
import { PlayerAlert } from "@lichtblick/suite-base/players/types";

const selectPlayerAlerts = ({ playerState }: MessagePipelineContext) => playerState.alerts;
const selectSessionAlerts = (store: AlertsContextStore) => store.alerts;

export default function useAlertCount(): {
  playerAlerts: readonly PlayerAlert[];
  sessionAlerts: AlertsContextStore["alerts"];
  alertCount: number;
} {
  const playerAlerts = useMessagePipeline(selectPlayerAlerts) ?? [];
  const sessionAlerts = useAlertsStore(selectSessionAlerts);

  return {
    playerAlerts,
    sessionAlerts,
    alertCount: playerAlerts.length + sessionAlerts.length,
  };
}
