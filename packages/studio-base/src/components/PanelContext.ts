// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { MessagePathDropConfig } from "@foxglove/studio-base/components/PanelExtensionAdapter";
import { SaveConfig, PanelConfig, OpenSiblingPanel } from "@foxglove/studio-base/types/panels";

export type PanelContextType<T> = {
  type: string;
  id: string;
  title: string;
  tabId?: string;

  config: PanelConfig;
  saveConfig: SaveConfig<T>;

  updatePanelConfigs: (panelType: string, updateConfig: (config: T) => T) => void;
  openSiblingPanel: OpenSiblingPanel;
  replacePanel: (panelType: string, config: Record<string, unknown>) => void;

  enterFullscreen: () => void;
  exitFullscreen: () => void;
  isFullscreen: boolean;

  /** Used to adjust z-index settings on parent panels when children are fullscreen */
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setHasFullscreenDescendant: (hasFullscreenDescendant: boolean) => void;

  connectToolbarDragHandle?: (el: Element | ReactNull) => void;

  setMessagePathDropConfig: (config: MessagePathDropConfig | undefined) => void;
};

// Context used for components to know which panel they are inside
const PanelContext = React.createContext<PanelContextType<PanelConfig> | undefined>(undefined);
PanelContext.displayName = "PanelContext";

export function usePanelContext(): PanelContextType<PanelConfig> {
  const context = React.useContext(PanelContext);
  if (!context) {
    throw new Error("Tried to use PanelContext outside a <PanelContext.Provider />");
  }
  return context;
}

export default PanelContext;
