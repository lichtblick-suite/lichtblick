// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReactNode } from "react";
import { DeepReadonly } from "ts-essentials";
import create, { StoreApi } from "zustand";
import createContext from "zustand/context";

import { SettingsTree } from "@foxglove/studio-base/components/SettingsTreeEditor/types";

type ImmutableSettingsTree = DeepReadonly<SettingsTree>;

type PanelSettingsEditorStore = {
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

export function usePanelSettingsTreeUpdate(): PanelSettingsEditorStore["updateSettingsTree"] {
  return useStore((state) => state.updateSettingsTree);
}

export function PanelSettingsEditorContextProvider({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  return <Provider createStore={createSettingsEditorStore}>{children}</Provider>;
}
