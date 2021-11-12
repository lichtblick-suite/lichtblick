// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ComponentType, createContext, useContext } from "react";

import { PanelStatics } from "@foxglove/studio-base/components/Panel";
import { PanelConfig, PanelConfigSchema } from "@foxglove/studio-base/types/panels";

export type PanelComponent = ComponentType<{ childId?: string; tabId?: string }> &
  PanelStatics<PanelConfig>;

export type PanelInfo = {
  title: string;
  type: string;

  help?: React.ReactNode;
  /**
   * The panel module is a function to load the panel.
   * This is to support our lazy built-in panels
   */
  module: () => Promise<{ default: PanelComponent }>;
  config?: PanelConfig;
  relatedConfigs?: { [panelId: string]: PanelConfig };
  preconfigured?: boolean;
};

/** PanelCatalog describes the interface for getting available panels */
export interface PanelCatalog {
  /** get a list of the available panels */
  getPanels(): readonly PanelInfo[];

  /** Get panel information for a specific panel type (i.e. 3d, map, image, etc) */
  getPanelByType(type: string): PanelInfo | undefined;

  /**
   * Get the configuration schema for a specific panel type
   *
   * This is async to support lazy loading our builtin panels
   */
  getConfigSchema(type: string): Promise<PanelConfigSchema<Record<string, unknown>> | undefined>;
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
