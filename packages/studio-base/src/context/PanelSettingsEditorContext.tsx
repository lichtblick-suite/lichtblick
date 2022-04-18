// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, ReactNode, useCallback, useMemo, useState } from "react";
import { DeepReadonly } from "ts-essentials";

import { SettingsTree } from "@foxglove/studio-base/components/SettingsTreeEditor/types";

export type ImmutableSettingsTree = DeepReadonly<SettingsTree>;

type SettingsTreeUpdateSubscriber = (settingsTree: ImmutableSettingsTree) => void;

export type PanelSettingsEditorContextType = {
  addUpdateSubscriber: (panelId: string, subscriber: SettingsTreeUpdateSubscriber) => void;
  removeUpdateSubscriber: (panelId: string, subscriber: SettingsTreeUpdateSubscriber) => void;
  updatePanelSettingsTree: (panelId: string, settings: undefined | SettingsTree) => void;
};

export const PanelSettingsEditorContext = createContext<PanelSettingsEditorContextType>({
  addUpdateSubscriber: () => {},
  removeUpdateSubscriber: () => {},
  updatePanelSettingsTree: () => {},
});

export function PanelSettingsEditorContextProvider({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const [subscribers] = useState(new Map<string, Set<SettingsTreeUpdateSubscriber>>());
  const [panelSettingsTrees] = useState(new Map<string, ImmutableSettingsTree>());

  const addUpdateSubscriber = useCallback(
    (panelId: string, subscriber: SettingsTreeUpdateSubscriber) => {
      subscribers.set(panelId, subscribers.get(panelId) ?? new Set());
      subscribers.get(panelId)!.add(subscriber);
      const tree = panelSettingsTrees.get(panelId);
      if (tree) {
        subscriber(tree);
      }
    },
    [panelSettingsTrees, subscribers],
  );

  const removeUpdateSubscriber = useCallback(
    (panelId: string, subscriber: SettingsTreeUpdateSubscriber) => {
      subscribers.get(panelId)?.delete(subscriber);
    },
    [subscribers],
  );

  const updatePanelSettingsTree = useCallback(
    (panelId: string, settings: undefined | SettingsTree) => {
      if (settings) {
        panelSettingsTrees.set(panelId, settings);
        for (const subscriber of subscribers.get(panelId) ?? []) {
          subscriber(settings);
        }
      } else {
        panelSettingsTrees.delete(panelId);
      }
    },
    [panelSettingsTrees, subscribers],
  );

  const contextValue = useMemo(
    () => ({
      addUpdateSubscriber,
      removeUpdateSubscriber,
      updatePanelSettingsTree,
    }),
    [addUpdateSubscriber, removeUpdateSubscriber, updatePanelSettingsTree],
  );

  return (
    <PanelSettingsEditorContext.Provider value={contextValue}>
      {children}
    </PanelSettingsEditorContext.Provider>
  );
}
