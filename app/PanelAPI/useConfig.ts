// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { savePanelConfigs } from "@foxglove-studio/app/actions/panels";
import { usePanelCatalog } from "@foxglove-studio/app/context/PanelCatalogContext";
import { usePanelId } from "@foxglove-studio/app/context/PanelIdContext";
import { State } from "@foxglove-studio/app/reducers";
import { SaveConfig } from "@foxglove-studio/app/types/panels";
import { getPanelTypeFromId } from "@foxglove-studio/app/util/layout";

/**
 * Mix partial panel config from savedProps with the panel type's `defaultConfig` to form the complete panel configuration.
 */
export function useConfig<Config>(): [Config, SaveConfig<Config>] {
  const panelId = usePanelId();
  const panelCatalog = usePanelCatalog();
  const panelComponent = useMemo(
    () =>
      panelId != undefined
        ? panelCatalog.getComponentForType(getPanelTypeFromId(panelId))
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
  const config = useSelector((state: State) =>
    panelId != undefined
      ? (state.persistedState.panels.savedProps[panelId] as Config | undefined)
      : undefined,
  );
  if (panelId != undefined && !defaultConfig) {
    throw new Error(`Attempt to useConfig() but panel ${panelId} has no defaultConfig`);
  }

  const dispatch = useDispatch();

  const saveConfig: SaveConfig<Config> = useCallback(
    (newConfig) => {
      if (panelId != undefined && defaultConfig != undefined) {
        dispatch(
          savePanelConfigs({
            configs: [{ id: panelId, config: newConfig, defaultConfig }],
          }),
        );
      }
    },
    [dispatch, defaultConfig, panelId],
  );

  const mergedConfig = useMemo(() => ({ ...(defaultConfig as Config), ...config }), [
    defaultConfig,
    config,
  ]);

  return [mergedConfig, saveConfig];
}
