// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { ReactNode, useState } from "react";
import { StoreApi, createStore } from "zustand";
import { persist } from "zustand/middleware";

import { SESSION_STORAGE_LICHTBLICK_WORKSPACE } from "@lichtblick/suite-base/constants/browserStorageKeys";
import {
  WorkspaceContext,
  WorkspaceContextStore,
} from "@lichtblick/suite-base/context/Workspace/WorkspaceContext";
import { migrateV0WorkspaceState } from "@lichtblick/suite-base/context/Workspace/migrations";

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
      syncInstances: false,
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
      name: SESSION_STORAGE_LICHTBLICK_WORKSPACE,
      version: 1,
      migrate: migrateV0WorkspaceState,
      partialize: (state) => {
        // Note that this is an opt-in list of keys from the store that we
        // include and restore when persisting to and from localStorage.
        return _.pick(state, ["featureTours", "playbackControls", "sidebars"]);
      },
      merge(persistedState, currentState) {
        // Use a deep merge to ensure that defaults are filled in for nested values if the values
        // were not present in localStorage.
        return _.merge(currentState, persistedState);
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
}): React.JSX.Element {
  const { children, initialState, workspaceStoreCreator, disablePersistenceForStorybook } = props;

  const [store] = useState(() =>
    workspaceStoreCreator
      ? workspaceStoreCreator(initialState, { disablePersistenceForStorybook })
      : createWorkspaceContextStore(initialState, { disablePersistenceForStorybook }),
  );

  return <WorkspaceContext.Provider value={store}>{children}</WorkspaceContext.Provider>;
}
