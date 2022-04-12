// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, ReactNode, useCallback, useMemo, useState } from "react";
import { DeepReadonly } from "ts-essentials";

import { SettingsTree } from "@foxglove/studio-base/components/SettingsTreeEditor/types";

export type PanelSettingsEditorContextType = {
  panelSettingsTrees: DeepReadonly<Record<string, SettingsTree>>;
  updatePanelSettingsTree: (panelId: string, settings: undefined | SettingsTree) => void;
};

export const PanelSettingsEditorContext = createContext<PanelSettingsEditorContextType>({
  panelSettingsTrees: {},
  updatePanelSettingsTree: () => {},
});

export function PanelSettingsEditorContextProvider({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const [panelSettingsTrees, setPanelSettingsTrees] = useState<Record<string, SettingsTree>>({});

  const updatePanelSettingsTree = useCallback(
    (panelId: string, settings: undefined | SettingsTree) => {
      if (settings) {
        setPanelSettingsTrees((previous) => ({ ...previous, [panelId]: settings }));
      } else {
        setPanelSettingsTrees((previous) => {
          const newPanelSettingsTrees = { ...previous };
          delete newPanelSettingsTrees[panelId];
          return newPanelSettingsTrees;
        });
      }
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
      panelSettingsTrees,
      updatePanelSettingsTree,
    }),
    [panelSettingsTrees, updatePanelSettingsTree],
  );

  return (
    <PanelSettingsEditorContext.Provider value={contextValue}>
      {children}
    </PanelSettingsEditorContext.Provider>
  );
}
