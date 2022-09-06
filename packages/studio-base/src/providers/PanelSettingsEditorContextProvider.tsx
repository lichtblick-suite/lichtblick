// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReactNode, useCallback, useState } from "react";
import { createStore, StoreApi } from "zustand";

import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import {
  ImmutableSettingsTree,
  PanelSettingsEditorContext,
  PanelSettingsEditorStore,
  usePanelSettingsEditorStore,
} from "@foxglove/studio-base/context/PanelSettingsEditorContext";

function createSettingsEditorStore(): StoreApi<PanelSettingsEditorStore> {
  return createStore((set) => {
    return {
      settingsTrees: {},
      updateSettingsTree: (panelId, settingsTree) => {
        set((state) => ({
          settingsTrees: {
            ...state.settingsTrees,
            [panelId]: settingsTree,
          },
        }));
      },
    };
  });
}

const updateSettingsTreeSelector = (store: PanelSettingsEditorStore) => store.updateSettingsTree;

/**
 * Returns updater function for the current panels settings tree.
 */
export function usePanelSettingsTreeUpdate(): (newTree: ImmutableSettingsTree) => void {
  const { id } = usePanelContext();
  const updateStoreTree = usePanelSettingsEditorStore(updateSettingsTreeSelector);

  const updateSettingsTree = useCallback(
    (newTree: ImmutableSettingsTree) => {
      updateStoreTree(id, newTree);
    },
    [id, updateStoreTree],
  );

  return updateSettingsTree;
}

export function PanelSettingsEditorContextProvider({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const [store] = useState(createSettingsEditorStore());

  return (
    <PanelSettingsEditorContext.Provider value={store}>
      {children}
    </PanelSettingsEditorContext.Provider>
  );
}
