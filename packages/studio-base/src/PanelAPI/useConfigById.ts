// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback } from "react";

import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

/**
 * Like `useConfig`, but for a specific panel id. This generally shouldn't be used by panels
 * directly, but is for use in internal code that's running outside of regular context providers.
 */
export default function useConfigById<Config extends Record<string, unknown>>(
  panelId: string | undefined,
): [Config | undefined, SaveConfig<Config>] {
  const { savePanelConfigs } = useCurrentLayoutActions();

  const configSelector = useCallback(
    (state: LayoutState) => {
      if (panelId == undefined) {
        return undefined;
      }
      return state.selectedLayout?.data?.configById?.[panelId] as Config | undefined;
    },
    [panelId],
  );

  const config = useCurrentLayoutSelector(configSelector);

  const saveConfig: SaveConfig<Config> = useCallback(
    (newConfig) => {
      if (panelId != undefined) {
        savePanelConfigs({
          configs: [{ id: panelId, config: newConfig }],
        });
      }
    },
    [panelId, savePanelConfigs],
  );

  return [config, saveConfig];
}
