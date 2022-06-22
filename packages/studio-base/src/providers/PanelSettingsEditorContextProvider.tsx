// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReactNode, useCallback } from "react";
import { DeepReadonly } from "ts-essentials";
import create, { StoreApi } from "zustand";
import createContext from "zustand/context";

import { SettingsTree } from "@foxglove/studio";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";

type ImmutableSettingsTree = DeepReadonly<SettingsTree>;

export type PanelSettingsEditorStore = {
  settingsTrees: Record<string, ImmutableSettingsTree>;
  updateSettingsTree: (panelId: string, settingsTree: ImmutableSettingsTree) => void;
};

const { Provider, useStore } = createContext<StoreApi<PanelSettingsEditorStore>>();

export function createSettingsEditorStore(): StoreApi<PanelSettingsEditorStore> {
  return create((set) => {
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

export const usePanelSettingsEditorStore = useStore;

const updateSettingsTreeSelector = (store: PanelSettingsEditorStore) => store.updateSettingsTree;

/**
 * Returns updater function for the current panels settings tree.
 */
export function usePanelSettingsTreeUpdate(): (newTree: ImmutableSettingsTree) => void {
  const { id } = usePanelContext();
  const updateStoreTree = useStore(updateSettingsTreeSelector);

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
  return <Provider createStore={createSettingsEditorStore}>{children}</Provider>;
}
