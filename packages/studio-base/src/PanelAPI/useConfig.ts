// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useMemo } from "react";

import {
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { usePanelCatalog } from "@foxglove/studio-base/context/PanelCatalogContext";
import { usePanelId } from "@foxglove/studio-base/context/PanelIdContext";
import { SaveConfig } from "@foxglove/studio-base/types/panels";
import { getPanelTypeFromId } from "@foxglove/studio-base/util/layout";

/**
 * Load/Save panel configuration. This behaves in a manner similar to React.useState except the state
 * is persisted with the current layout.
 */
export function useConfig<Config>(): [Config, (config: Partial<Config>) => void] {
  const panelId = usePanelId();
  const panelCatalog = usePanelCatalog();
  const panelComponent = useMemo(
    () =>
      panelId != undefined
        ? panelCatalog.getPanelByType(getPanelTypeFromId(panelId))?.component
        : undefined,
    [panelCatalog, panelId],
  );
  if (panelId != undefined && !panelComponent) {
    throw new Error(`Attempt to useConfig() with unknown panel id ${panelId}`);
  }
  return useConfigById(panelId, panelComponent?.defaultConfig);
}

/**
 * Like `useConfig`, but for a specific panel id. This generally shouldn't be used by panels
 * directly, but is for use in internal code that's running outside of regular context providers.
 */
export function useConfigById<Config>(
  panelId: string | undefined,
  defaultConfig: Config | undefined,
): [Config, SaveConfig<Config>] {
  const { savePanelConfigs } = useCurrentLayoutActions();
  const config = useCurrentLayoutSelector((state) =>
    panelId != undefined
      ? (state.selectedLayout?.data.configById[panelId] as Config | undefined)
      : undefined,
  );
  if (panelId != undefined && !defaultConfig) {
    throw new Error(`Attempt to useConfig() but panel ${panelId} has no defaultConfig`);
  }

  const saveConfig: SaveConfig<Config> = useCallback(
    (newConfig) => {
      if (panelId != undefined && defaultConfig != undefined) {
        savePanelConfigs({
          configs: [{ id: panelId, config: newConfig, defaultConfig }],
        });
      }
    },
    [panelId, defaultConfig, savePanelConfigs],
  );

  const mergedConfig = useMemo(
    () => ({ ...(defaultConfig as Config), ...config }),
    [defaultConfig, config],
  );

  return [mergedConfig, saveConfig];
}
