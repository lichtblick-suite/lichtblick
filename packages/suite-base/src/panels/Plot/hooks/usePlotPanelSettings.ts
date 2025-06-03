// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { produce } from "immer";
import * as _ from "lodash-es";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { SettingsTreeAction, SettingsTreeActionUpdatePayload } from "@lichtblick/suite";
import { DEFAULT_PLOT_PATH } from "@lichtblick/suite-base/panels/Plot/constants";
import { buildSettingsTree } from "@lichtblick/suite-base/panels/Plot/utils/buildSettingsTree";
import { usePanelSettingsTreeUpdate } from "@lichtblick/suite-base/providers/PanelStateContextProvider";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

import { PlotConfig, PlotLegendDisplay } from "../utils/config";

export type HandleAction = {
  draft: PlotConfig;
};

export type HandleDeleteSeriesAction = HandleAction & {
  index: number;
};

export type HandleUpdateAction = HandleAction & Omit<SettingsTreeActionUpdatePayload, "input">;

export function handleUpdateAction({ draft, path, value }: HandleUpdateAction): void {
  if (path[0] === "paths") {
    if (draft.paths.length === 0) {
      draft.paths.push({ ...DEFAULT_PLOT_PATH });
    }

    if (path[2] === "visible") {
      _.set(draft, [...path.slice(0, 2), "enabled"], value);
    } else {
      _.set(draft, path, value);
    }
  } else if (_.isEqual(path, ["legend", "legendDisplay"])) {
    draft.legendDisplay = value as PlotLegendDisplay;
    draft.showLegend = true;
  } else if (_.isEqual(path, ["xAxis", "xAxisPath"])) {
    _.set(draft, ["xAxisPath", "value"], value);
  } else {
    _.set(draft, path.slice(1), value);

    // X min/max and following width are mutually exclusive.
    if (path[1] === "followingViewWidth") {
      draft.minXValue = undefined;
      draft.maxXValue = undefined;
    } else if (path[1] === "minXValue" || path[1] === "maxXValue") {
      draft.followingViewWidth = undefined;
    }
  }
}

export function handleAddSeriesAction({ draft }: HandleAction): void {
  if (draft.paths.length === 0) {
    draft.paths.push({ ...DEFAULT_PLOT_PATH });
  }
  draft.paths.push({ ...DEFAULT_PLOT_PATH });
}

export function handleDeleteSeriesAction({ draft, index }: HandleDeleteSeriesAction): void {
  draft.paths.splice(Number(index), 1);
}

export default function usePlotPanelSettings(
  config: PlotConfig,
  saveConfig: SaveConfig<PlotConfig>,
  focusedPath?: readonly string[],
): void {
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();
  const { t } = useTranslation("plot");

  const actionHandler = useCallback(
    ({ action, payload }: SettingsTreeAction) => {
      if (action === "update") {
        const { path, value } = payload;
        saveConfig(
          produce((draft: PlotConfig) => {
            handleUpdateAction({ draft, path, value });
          }),
        );
      } else if (payload.id === "add-series") {
        saveConfig(
          produce<PlotConfig>((draft: PlotConfig) => {
            handleAddSeriesAction({ draft });
          }),
        );
      } else if (payload.id === "delete-series") {
        saveConfig(
          produce<PlotConfig>((draft) => {
            handleDeleteSeriesAction({ draft, index: Number(payload.path[1]) });
          }),
        );
      }
    },
    [saveConfig],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      focusedPath,
      nodes: buildSettingsTree(config, t),
    });
  }, [actionHandler, config, focusedPath, updatePanelSettingsTree, t]);
}
