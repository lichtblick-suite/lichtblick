// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback } from "react";

import {
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { usePanelId } from "@foxglove/studio-base/context/PanelIdContext";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

/**
 * Load/Save panel configuration. This behaves in a manner similar to React.useState except the state
 * is persisted with the current layout.
 */
export function useConfig<Config extends Record<string, unknown>>(): [
  Config | undefined,
  (config: Partial<Config>) => void,
] {
  const panelId = usePanelId();
  return useConfigById(panelId);
}

/**
 * Like `useConfig`, but for a specific panel id. This generally shouldn't be used by panels
 * directly, but is for use in internal code that's running outside of regular context providers.
 */
export function useConfigById<Config extends Record<string, unknown>>(
  panelId: string | undefined,
): [Config | undefined, SaveConfig<Config>] {
  const { savePanelConfigs } = useCurrentLayoutActions();

  // get the config from the current layout state
  // if there is no config in the current layout state...then we would return undefined?
  const config = useCurrentLayoutSelector((state) =>
    panelId != undefined
      ? (state.selectedLayout?.data.configById[panelId] as Config | undefined)
      : undefined,
  );

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
