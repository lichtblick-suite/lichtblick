// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ComponentType, createContext, useContext } from "react";

import { PanelStatics } from "@lichtblick/suite-base/components/types";
import { Namespace } from "@lichtblick/suite-base/types";
import { PanelConfig } from "@lichtblick/suite-base/types/panels";

export type PanelComponent = ComponentType<{ childId?: string; tabId?: string }> &
  PanelStatics<PanelConfig>;

export type PanelInfo = {
  title: string;
  type: string;
  description?: string;
  thumbnail?: string;
  help?: React.ReactNode;

  /** Set this to true if a panel has custom toolbar items and so cannot be renamed. */
  hasCustomToolbar?: boolean;

  /**
   * The panel module is a function to load the panel.
   * This is to support our lazy built-in panels
   */
  module: () => Promise<{ default: PanelComponent }>;
  config?: PanelConfig;
  extensionNamespace?: Namespace;
};

/** PanelCatalog describes the interface for getting available panels */
export interface PanelCatalog {
  /** get a list of the available panels */
  getPanels(): readonly PanelInfo[];

  /** Get panel information for a specific panel type (i.e. 3d, map, image, etc) */
  getPanelByType(type: string): PanelInfo | undefined;
}

const PanelCatalogContext = createContext<PanelCatalog | undefined>(undefined);
PanelCatalogContext.displayName = "PanelCatalogContext";

export function usePanelCatalog(): PanelCatalog {
  const panelCatalog = useContext(PanelCatalogContext);
  if (!panelCatalog) {
    throw new Error("A PanelCatalogContext provider is required to usePanelCatalog");
  }

  return panelCatalog;
}

export default PanelCatalogContext;
