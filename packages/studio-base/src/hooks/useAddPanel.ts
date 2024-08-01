// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PanelSelection } from "@lichtblick/studio-base/components/PanelCatalog";
import { useCurrentLayoutActions } from "@lichtblick/studio-base/context/CurrentLayoutContext";
import { getPanelIdForType } from "@lichtblick/studio-base/util/layout";
import { useCallback } from "react";

export default function useAddPanel(): (selection: PanelSelection) => void {
  const { addPanel } = useCurrentLayoutActions();
  return useCallback(
    ({ type, config }: PanelSelection) => {
      const id = getPanelIdForType(type);
      addPanel({ id, config });
    },
    [addPanel],
  );
}
