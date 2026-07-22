// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "immer";
import * as _ from "lodash-es";
import { ReactNode, useState } from "react";
import { StoreApi, create } from "zustand";

import {
  AlertsContext,
  AlertsContextStore,
  SessionAlert,
  getPlayerAlertKey,
} from "@lichtblick/suite-base/context/AlertsContext";

function createAlertsStore(): StoreApi<AlertsContextStore> {
  return create<AlertsContextStore>((set, get) => {
    return {
      alerts: [],
      dismissedPlayerAlertKeys: new Set<string>(),
      dismissedSessionTags: new Map<string, string>(),
      actions: {
        clearAlert: (tag: string) => {
          const alerts = get().alerts;
          const dismissed = get().dismissedSessionTags;
          const existing = alerts.find((al) => al.tag === tag);
          const next = new Map(dismissed);
          if (existing) {
            next.set(tag, getPlayerAlertKey(existing));
          }
          set({
            alerts: alerts.filter((al) => al.tag !== tag),
            dismissedSessionTags: next,
          });
        },
        clearAlerts: () => {
          set({ alerts: [] });
        },
        setAlert: (tag: string, alert: Immutable<SessionAlert>) => {
          const newAlert = { tag, ...alert };
          const alerts = get().alerts;
          const existing = alerts.find((al) => al.tag === tag);
          if (existing && _.isEqual(existing, newAlert)) {
            return;
          }

          const dismissed = get().dismissedSessionTags;
          const dismissedKey = dismissed.get(tag);
          if (dismissedKey != undefined) {
            const newKey = getPlayerAlertKey(alert);
            if (dismissedKey === newKey) {
              return;
            }

            const nextDismissed = new Map(dismissed);
            nextDismissed.delete(tag);
            set({
              alerts: [newAlert, ...alerts.filter((al) => al.tag !== tag)],
              dismissedSessionTags: nextDismissed,
            });
            return;
          }

          set({ alerts: [newAlert, ...alerts.filter((al) => al.tag !== tag)] });
        },
        dismissPlayerAlert: (key: string) => {
          const dismissed = get().dismissedPlayerAlertKeys;
          if (dismissed.has(key)) {
            return;
          }
          set({ dismissedPlayerAlertKeys: new Set(dismissed).add(key) });
        },
        dismissPlayerAlerts: (keys: readonly string[]) => {
          const dismissed = get().dismissedPlayerAlertKeys;
          const next = new Set(dismissed);
          for (const key of keys) {
            next.add(key);
          }
          if (next.size === dismissed.size) {
            return;
          }
          set({ dismissedPlayerAlertKeys: next });
        },
        restoreDismissedPlayerAlerts: () => {
          if (get().dismissedPlayerAlertKeys.size === 0) {
            return;
          }
          set({ dismissedPlayerAlertKeys: new Set<string>() });
        },
      },
    };
  });
}

export default function AlertsContextProvider({
  children,
}: {
  children?: ReactNode;
}): React.JSX.Element {
  const [store] = useState(createAlertsStore);
  return <AlertsContext.Provider value={store}>{children}</AlertsContext.Provider>;
}
