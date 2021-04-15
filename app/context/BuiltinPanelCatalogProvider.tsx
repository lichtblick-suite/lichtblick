// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";

import PanelCatalogContext from "@foxglove-studio/app/context/PanelCatalogContext";
import BuiltinPanelCatalog from "@foxglove-studio/app/services/BuiltinPanelCatalog";

export default function BuiltinPanelCatalogProvider(
  props: PropsWithChildren<unknown>,
): React.ReactElement {
  const panelCatalog = useMemo(() => new BuiltinPanelCatalog(), []);
  return (
    <PanelCatalogContext.Provider value={panelCatalog}>
      {props.children}
    </PanelCatalogContext.Provider>
  );
}
