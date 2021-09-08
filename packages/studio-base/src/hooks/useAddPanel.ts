// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { useCallback } from "react";

import { PanelSelection } from "@foxglove/studio-base/components/PanelList";
import {
  useCurrentLayoutActions,
  useSelectedPanels,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";
import { getPanelIdForType } from "@foxglove/studio-base/util/layout";

export default function useAddPanel(): (selection: PanelSelection) => void {
  const { addPanel } = useCurrentLayoutActions();
  const { openPanelSettings } = useWorkspace();
  const { setSelectedPanelIds } = useSelectedPanels();
  return useCallback(
    ({ type, config, relatedConfigs }: PanelSelection) => {
      const id = getPanelIdForType(type);
      addPanel({ id, config, relatedConfigs });
      setSelectedPanelIds([id]);
      openPanelSettings();
    },
    [addPanel, setSelectedPanelIds, openPanelSettings],
  );
}
