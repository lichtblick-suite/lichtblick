// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { ReactNode, useState } from "react";
import { StoreApi, createStore } from "zustand";
import { persist } from "zustand/middleware";

import {
  WorkspaceContext,
  WorkspaceContextStore,
} from "@foxglove/studio-base/context/Workspace/WorkspaceContext";
import { migrateV0WorkspaceState } from "@foxglove/studio-base/context/Workspace/migrations";

/**
 * Creates the default initial state for the workspace store.
 */
export function makeWorkspaceContextInitialState(): WorkspaceContextStore {
  return {
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
  };
}

function createWorkspaceContextStore(
  initialState?: Partial<WorkspaceContextStore>,
  options?: { disablePersistenceForStorybook?: boolean },
): StoreApi<WorkspaceContextStore> {
  const stateCreator = () => {
    const store: WorkspaceContextStore = {
      ...makeWorkspaceContextInitialState(),
      ...initialState,
    };
    return store;
  };
  if (options?.disablePersistenceForStorybook === true) {
    return createStore<WorkspaceContextStore>()(stateCreator);
  }
  return createStore<WorkspaceContextStore>()(
    persist(stateCreator, {
      name: "fox.workspace",
      version: 1,
      migrate: migrateV0WorkspaceState,
      partialize: (state) => {
        // Note that this is an opt-in list of keys from the store that we
        // include and restore when persisting to and from localStorage.
        return _.pick(state, ["featureTours", "playbackControls", "sidebars"]);
      },
    }),
  );
}

export default function WorkspaceContextProvider(props: {
  children?: ReactNode;
  disablePersistenceForStorybook?: boolean;
  initialState?: Partial<WorkspaceContextStore>;
  workspaceStoreCreator?: (
    initialState?: Partial<WorkspaceContextStore>,
    options?: { disablePersistenceForStorybook?: boolean },
  ) => StoreApi<WorkspaceContextStore>;
}): JSX.Element {
  const { children, initialState, workspaceStoreCreator, disablePersistenceForStorybook } = props;

  const [store] = useState(() =>
    workspaceStoreCreator
      ? workspaceStoreCreator(initialState, { disablePersistenceForStorybook })
      : createWorkspaceContextStore(initialState, { disablePersistenceForStorybook }),
  );

  return <WorkspaceContext.Provider value={store}>{children}</WorkspaceContext.Provider>;
}
