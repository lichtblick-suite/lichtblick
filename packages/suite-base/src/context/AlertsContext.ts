// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";
import { StoreApi, useStore } from "zustand";

import { useGuaranteedContext } from "@lichtblick/hooks";
import { Immutable } from "@lichtblick/suite";
import { PlayerAlert } from "@lichtblick/suite-base/players/types";

export type SessionAlert = PlayerAlert;

type TaggedAlert = SessionAlert & { tag: string };

export type AlertsContextStore = Immutable<{
  alerts: TaggedAlert[];
  /**
   * Content-based keys of player alerts the user has dismissed. Player alerts are owned by the
   * Player and re-emitted on state changes, so they cannot be removed from the store directly;
   * instead we hide them by key until the underlying condition changes and produces a new key.
   */
  dismissedPlayerAlertKeys: Set<string>;
  /**
   * Tags of session alerts the user has dismissed along with their content key at the time of
   * dismissal. If a panel re-sets the same tag with identical content, it stays dismissed. If the
   * content changes, the tag is removed from this map and the alert reappears.
   */
  dismissedSessionTags: Map<string, string>;
  actions: {
    clearAlert: (tag: string) => void;
    clearAlerts: () => void;
    setAlert: (tag: string, alert: Immutable<SessionAlert>) => void;
    dismissPlayerAlert: (key: string) => void;
    dismissPlayerAlerts: (keys: readonly string[]) => void;
    restoreDismissedPlayerAlerts: () => void;
  };
}>;

/**
 * Builds a stable, content-based key for a player alert so it can be tracked as dismissed. The key
 * changes when the alert's severity or message changes, allowing a re-emitted-but-changed alert to
 * reappear.
 */
export function getPlayerAlertKey(alert: Pick<PlayerAlert, "severity" | "message">): string {
  return `${alert.severity}::${alert.message}`;
}

export const AlertsContext = createContext<undefined | StoreApi<AlertsContextStore>>(undefined);

AlertsContext.displayName = "AlertsContext";

/**
 * Fetches values from the alerts store.
 */
export function useAlertsStore<T>(selector: (store: AlertsContextStore) => T): T {
  const context = useGuaranteedContext(AlertsContext);
  return useStore(context, selector);
}

const selectActions = (store: AlertsContextStore) => store.actions;

/**
 * Convenience hook for accessing alerts store actions.
 */
export function useAlertsActions(): AlertsContextStore["actions"] {
  return useAlertsStore(selectActions);
}
