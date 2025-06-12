// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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
  actions: {
    clearAlert: (tag: string) => void;
    setAlert: (tag: string, alert: Immutable<SessionAlert>) => void;
  };
}>;

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
