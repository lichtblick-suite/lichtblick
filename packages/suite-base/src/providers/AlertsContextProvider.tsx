// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "immer";
import { ReactNode, useState } from "react";
import { StoreApi, create } from "zustand";

import {
  AlertsContext,
  AlertsContextStore,
  SessionAlert,
} from "@lichtblick/suite-base/context/AlertsContext";

function createAlertsStore(): StoreApi<AlertsContextStore> {
  return create<AlertsContextStore>((set, get) => {
    return {
      alerts: [],
      actions: {
        clearAlert: (tag: string) => {
          set({
            alerts: get().alerts.filter((al) => al.tag !== tag),
          });
        },
        setAlert: (tag: string, alert: Immutable<SessionAlert>) => {
          const newAlerts = get().alerts.filter((al) => al.tag !== tag);

          set({
            alerts: [{ tag, ...alert }, ...newAlerts],
          });
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
