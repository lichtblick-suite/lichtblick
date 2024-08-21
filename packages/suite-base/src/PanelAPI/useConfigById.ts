// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { useCallback } from "react";
import { DeepPartial } from "ts-essentials";

import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";
import {
  getExtensionPanelSettings,
  useExtensionCatalog,
} from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";
import { maybeCast } from "@lichtblick/suite-base/util/maybeCast";

import { getPanelTypeFromId } from "../util/layout";

/**
 * Like `useConfig`, but for a specific panel id. This generally shouldn't be used by panels
 * directly, but is for use in internal code that's running outside of regular context providers.
 */
export default function useConfigById<Config extends Record<string, unknown>>(
  panelId: string | undefined,
): [Config | undefined, SaveConfig<Config>] {
  const { getCurrentLayoutState, savePanelConfigs } = useCurrentLayoutActions();
  const extensionSettings = useExtensionCatalog(getExtensionPanelSettings);
  const sortedTopics = useMessagePipeline((state) => state.sortedTopics);

  const configSelector = useCallback(
    (state: DeepPartial<LayoutState>) => {
      if (panelId == undefined) {
        return undefined;
      }
      const stateConfig = maybeCast<Config>(state.selectedLayout?.data?.configById?.[panelId]);
      const panelType = getPanelTypeFromId(panelId);
      const customSettingsByTopic: Record<string, unknown> = _.merge(
        {},
        ...sortedTopics.map(({ name: topic, schemaName }) => {
          if (schemaName == undefined) {
            return {};
          }
          const defaultConfig = extensionSettings[panelType]?.[schemaName]?.defaultConfig;
          if (defaultConfig == undefined) {
            return {};
          }
          return {
            [topic]: defaultConfig,
          };
        }),
        stateConfig?.topics,
      );
      if (Object.keys(customSettingsByTopic).length === 0) {
        return stateConfig;
      }
      return maybeCast<Config>({ ...stateConfig, topics: customSettingsByTopic });
    },
    [panelId, extensionSettings, sortedTopics],
  );

  const config = useCurrentLayoutSelector(configSelector);

  const saveConfig: SaveConfig<Config> = useCallback(
    (newConfig) => {
      if (panelId == undefined) {
        return;
      }

      if (typeof newConfig === "function") {
        // We use a getter here instead of referring directly to the config object
        // so that this callback is stable across config changes.
        const currentConfig = getCurrentLayoutState().selectedLayout?.data?.configById[panelId] as
          | undefined
          | Config;
        if (currentConfig) {
          savePanelConfigs({
            configs: [{ id: panelId, config: newConfig(currentConfig) }],
          });
        }
      } else {
        savePanelConfigs({
          configs: [{ id: panelId, config: newConfig }],
        });
      }
    },
    [getCurrentLayoutState, panelId, savePanelConfigs],
  );

  return [config, saveConfig];
}
