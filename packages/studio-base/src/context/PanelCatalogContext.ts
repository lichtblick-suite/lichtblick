// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ComponentType, createContext, useContext } from "react";

import { PanelStatics } from "@foxglove/studio-base/components/Panel";

export type PanelInfo = {
  title: string;
  component: ComponentType<any> & PanelStatics<any>;
};

// PanelCatalog describes the interface for getting available panels
export interface PanelCatalog {
  // get a list of the available panels
  getPanels(): readonly PanelInfo[];

  // Get panel information for a specific panel type (i.e. 3d, map, image, etc)
  getPanelByType(type: string): PanelInfo | undefined;
}

const PanelCatalogContext = createContext<PanelCatalog | undefined>(undefined);

export function usePanelCatalog(): PanelCatalog {
  const panelCatalog = useContext(PanelCatalogContext);
  if (!panelCatalog) {
    throw new Error("A PanelCatalogContext provider is required to usePanelCatalog");
  }

  return panelCatalog;
}

export default PanelCatalogContext;
