// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelCatalog, PanelInfo } from "@foxglove/studio-base/context/PanelCatalogContext";
import panels from "@foxglove/studio-base/panels";

// BuiltinPanelCatalog implements a PanelCatalog for all our builtin panels
class BuiltinPanelCatalog implements PanelCatalog {
  private _panels: PanelInfo[] = [];
  private _panelsByType = new Map<string, PanelInfo>();

  constructor() {
    this._panels = [...panels.builtin, ...panels.debug];

    for (const panel of this._panels) {
      const type = panel.component.panelType;
      this._panelsByType.set(type, panel);
    }

    for (const panel of panels.hidden) {
      this._panelsByType.set(panel.component.panelType, panel);
    }
  }

  getPanels(): PanelInfo[] {
    return this._panels;
  }

  getPanelByType(type: string): PanelInfo | undefined {
    return this._panelsByType.get(type);
  }
}

export default BuiltinPanelCatalog;
