// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

export const PanelSettingsContext = createContext({
  panelSettingsOpen: false,
  openPanelSettings: (): void => {
    throw new Error("Must be in a PanelSettingsContext.Provider to open panel settings");
  },
});

export function usePanelSettings(): { panelSettingsOpen: boolean; openPanelSettings: () => void } {
  return useContext(PanelSettingsContext);
}
