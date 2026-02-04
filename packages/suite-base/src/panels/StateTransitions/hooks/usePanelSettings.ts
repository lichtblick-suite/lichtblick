// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TFunction } from "i18next";
import { produce } from "immer";
import * as _ from "lodash-es";
import memoizeWeak from "memoize-weak";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import {
  SettingsTreeAction,
  SettingsTreeField,
  SettingsTreeNode,
  SettingsTreeNodeActionItem,
  SettingsTreeNodes,
} from "@lichtblick/suite";
import { DEFAULT_STATE_TRANSITION_PATH } from "@lichtblick/suite-base/panels/StateTransitions/constants";
import { PLOTABLE_ROS_TYPES } from "@lichtblick/suite-base/panels/shared/constants";
import { usePanelSettingsTreeUpdate } from "@lichtblick/suite-base/providers/PanelStateContextProvider";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";

import { stateTransitionPathDisplayName } from "../shared";
import {
  AxisTreeField,
  IUsePanelSettings,
  PathState,
  SeriesAction,
  SeriesActionId,
  StateTransitionConfig,
} from "../types";

// Note - we use memoizeWeak here instead of react memoization to allow us to memoize
// at the level of individual nodes in our tree. This keeps our DOM updates small since
// the NodeEditor component is wrapped in a React.memo.

export function setSeriesAction({ label, icon, id }: SeriesAction): SettingsTreeNodeActionItem {
  return {
    display: "inline",
    icon,
    id,
    label,
    type: "action",
  };
}

export const makeSeriesNode = memoizeWeak(
  (
    index: number,
    { path, canDelete, isArray }: PathState & { canDelete: boolean },
    t: TFunction<"stateTransitions">,
  ): SettingsTreeNode => {
    const action = setSeriesAction({
      label: t("labels.deleteSeries"),
      id: SeriesActionId.DELETE,
      icon: "Clear",
    });
    return {
      actions: canDelete ? [action] : [],
      label: stateTransitionPathDisplayName(path, index),
      fields: {
        value: {
          ...(isArray ? { error: t("pathErrorMessage") } : {}),
          input: "messagepath",
          label: t("labels.messagePath"),
          validTypes: PLOTABLE_ROS_TYPES,
          value: path.value,
        },
        label: {
          input: "string",
          label: t("labels.label"),
          value: path.label,
        },
        timestampMethod: {
          input: "select",
          label: t("labels.timestamp"),
          options: [
            { label: t("labels.timestampReceiveTime"), value: "receiveTime" },
            { label: t("labels.timestampHeaderStamp"), value: "headerStamp" },
          ],
          value: path.timestampMethod,
        },
      },
    };
  },
);

export const makeRootSeriesNode = memoizeWeak(
  (paths: PathState[], t: TFunction<"stateTransitions">): SettingsTreeNode => {
    const children = Object.fromEntries(
      paths.length === 0
        ? [
            [
              "0",
              makeSeriesNode(
                0,
                {
                  path: DEFAULT_STATE_TRANSITION_PATH,
                  isArray: false,
                  canDelete: false,
                },
                t,
              ),
            ],
          ]
        : paths.map(({ path, isArray }, index) => [
            `${index}`,
            makeSeriesNode(
              index,
              {
                path,
                isArray,
                canDelete: true,
              },
              t,
            ),
          ]),
    );
    return {
      label: t("labels.series"),
      children,
      actions: [
        setSeriesAction({
          label: t("labels.addSeries"),
          id: SeriesActionId.ADD,
          icon: "Addchart",
        }),
      ],
    };
  },
);

export function buildSettingsTree(
  { isSynced, xAxisMaxValue, xAxisMinValue, xAxisRange, showPoints }: StateTransitionConfig,
  paths: PathState[],
  t: TFunction<"stateTransitions">,
): SettingsTreeNodes {
  const maxXError =
    _.isNumber(xAxisMinValue) && _.isNumber(xAxisMaxValue) && xAxisMinValue >= xAxisMaxValue
      ? t("maxXError")
      : undefined;

  function setAxis({ value, label, error = undefined }: AxisTreeField): SettingsTreeField {
    return {
      label,
      input: "number",
      value,
      placeholder: "auto",
      error,
    };
  }

  return {
    general: {
      label: t("labels.general"),
      fields: {
        isSynced: { label: t("labels.sync"), input: "boolean", value: isSynced },
        showPoints: {
          help: t("labels.helpGeneral"),
          input: "boolean",
          label: t("labels.showPoints"),
          value: showPoints,
        },
      },
    },
    xAxis: {
      label: t("xAxis"),
      fields: {
        xAxisMaxValue: setAxis({ label: t("max"), value: xAxisMaxValue, error: maxXError }),
        xAxisMinValue: setAxis({ label: t("min"), value: xAxisMinValue }),
        xAxisRange: setAxis({ label: t("secondsRange"), value: xAxisRange }),
      },
    },
    paths: makeRootSeriesNode(paths, t),
  };
}

export function usePanelSettings(
  config: StateTransitionConfig,
  saveConfig: SaveConfig<StateTransitionConfig>,
  paths: PathState[],
  focusedPath?: readonly string[],
): IUsePanelSettings {
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();
  const { t } = useTranslation("stateTransitions");

  const actionHandler = useCallback(
    ({ action, payload }: SettingsTreeAction) => {
      if (action === "update") {
        const { input, path, value } = payload;

        if (input === "boolean" && _.isEqual(path, ["general", "isSynced"])) {
          saveConfig({ isSynced: value });
        } else if (input === "boolean" && _.isEqual(path, ["general", "showPoints"])) {
          saveConfig({ showPoints: value });
        } else if (path[0] === "xAxis") {
          saveConfig(
            produce((draft: StateTransitionConfig) => {
              _.set(draft, path.slice(1), value);

              // X min/max and range are mutually exclusive.
              if (path[1] === "xAxisRange") {
                draft.xAxisMinValue = undefined;
                draft.xAxisMaxValue = undefined;
              } else if (path[1] === "xAxisMinValue" || path[1] === "xAxisMaxValue") {
                draft.xAxisRange = undefined;
              }
            }),
          );
        } else {
          saveConfig(
            produce((draft: StateTransitionConfig) => {
              if (draft.paths.length === 0) {
                draft.paths.push({ ...DEFAULT_STATE_TRANSITION_PATH });
              }
              _.set(draft, path, value);
            }),
          );
        }
      }

      if (action === "perform-node-action") {
        if (payload.id === SeriesActionId.ADD) {
          saveConfig(
            produce((draft: StateTransitionConfig) => {
              if (draft.paths.length === 0) {
                draft.paths.push({ ...DEFAULT_STATE_TRANSITION_PATH });
              }
              draft.paths.push({ ...DEFAULT_STATE_TRANSITION_PATH });
            }),
          );
        } else if (payload.id === SeriesActionId.DELETE) {
          const index = payload.path[1];
          saveConfig(
            produce((draft) => {
              draft.paths.splice(Number(index), 1);
            }),
          );
        }
      }
    },
    [saveConfig],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      focusedPath,
      nodes: buildSettingsTree(config, paths, t),
    });
  }, [actionHandler, paths, config, focusedPath, t, updatePanelSettingsTree]);

  return { actionHandler };
}
