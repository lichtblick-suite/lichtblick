// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

export const PanelIdContext = createContext<string | undefined>(undefined);

export function usePanelId(): string {
  const panelId = useContext(PanelIdContext);
  if (panelId == undefined) {
    throw new Error("A PanelIdContext provider is required to usePanelId");
  }

  return panelId;
}
