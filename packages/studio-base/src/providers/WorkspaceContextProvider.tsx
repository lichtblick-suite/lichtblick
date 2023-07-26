// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { pick } from "lodash";
import { ReactNode, useState } from "react";
import { StoreApi, createStore } from "zustand";
import { persist } from "zustand/middleware";

import {
  WorkspaceContext,
  WorkspaceContextStore,
} from "@foxglove/studio-base/context/Workspace/WorkspaceContext";
import { migrateV0WorkspaceState } from "@foxglove/studio-base/context/Workspace/migrations";

function createWorkspaceContextStore(
  initialState?: Partial<WorkspaceContextStore>,
): StoreApi<WorkspaceContextStore> {
  return createStore<WorkspaceContextStore>()(
    persist(
      () => {
        const store: WorkspaceContextStore = {
          dialogs: {
            dataSource: {
              activeDataSource: undefined,
              item: undefined,
              open: false,
            },
            preferences: {
              initialTab: undefined,
              open: false,
            },
          },
          featureTours: {
            active: undefined,
            shown: [],
          },
          sidebars: {
            left: {
              item: "panel-settings",
              open: true,
              size: undefined,
            },
            right: {
              item: undefined,
              open: false,
              size: undefined,
            },
          },
          playbackControls: {
            repeat: false,
          },

          ...initialState,
        };
        return store;
      },
      {
        name: "fox.workspace",
        version: 1,
        migrate: migrateV0WorkspaceState,
        partialize: (value) => {
          // Note that this is an opt-in list of keys from the store that we
          // include and restore when persisting to and from localStorage.
          return pick(value, ["featureTours", "playbackControls", "sidebars"]);
        },
      },
    ),
  );
}

export default function WorkspaceContextProvider({
  children,
  initialState,
}: {
  children?: ReactNode;
  initialState?: Partial<WorkspaceContextStore>;
}): JSX.Element {
  const [store] = useState(() => createWorkspaceContextStore(initialState));

  return <WorkspaceContext.Provider value={store}>{children}</WorkspaceContext.Provider>;
}
