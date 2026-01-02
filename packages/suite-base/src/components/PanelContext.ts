// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelContextType } from "@lichtblick/suite-base/components/types";
import { PanelConfig } from "@lichtblick/suite-base/types/panels";

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
