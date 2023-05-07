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
} from "@foxglove/studio-base/context/WorkspaceContext";

function createWorkspaceContextStore(
  initialState?: Partial<WorkspaceContextStore>,
): StoreApi<WorkspaceContextStore> {
  return createStore<WorkspaceContextStore>()(
    persist(
      () => {
        const store: WorkspaceContextStore = {
          dataSourceDialog: {
            activeDataSource: undefined,
            item: undefined,
            open: false,
          },
          featureTours: {
            active: undefined,
            shown: [],
          },
          leftSidebarItem: "panel-settings",
          leftSidebarOpen: true,
          leftSidebarSize: undefined,
          playbackControls: {
            repeat: false,
          },
          prefsDialogState: {
            initialTab: undefined,
            open: false,
          },
          rightSidebarItem: undefined,
          rightSidebarOpen: false,
          rightSidebarSize: undefined,
          sidebarItem: "connection",
          ...initialState,
        };
        return store;
      },
      {
        name: "fox.workspace",
        partialize: (value) => {
          // Note that this is a list of keys from the store that we include and restore
          // when persisting to and from localStorage.
          return pick(value, [
            "featureTours",
            "leftSidebarItem",
            "leftSidebarOpen",
            "leftSidebarSize",
            "playbackControls",
            "rightSidebarItem",
            "rightSidebarOpen",
            "rightSidebarSize",
            "sidebarItem",
          ]);
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
