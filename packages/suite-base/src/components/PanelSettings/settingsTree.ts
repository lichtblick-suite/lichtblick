// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as _ from "lodash-es";

import { Immutable, PanelSettings, SettingsTree, SettingsTreeNode } from "@lichtblick/suite";
import { PanelStateStore } from "@lichtblick/suite-base/context/PanelStateContext";
import { maybeCast } from "@lichtblick/suite-base/util/maybeCast";

export type BuildSettingsTreeProps = {
  config: Record<string, unknown> | undefined;
  extensionSettings: Record<string, Record<string, PanelSettings<unknown>>>;
  panelType: string | undefined;
  selectedPanelId: string | undefined;
  state: PanelStateStore;
  topicToSchemaNameMap: Record<string, string | undefined>;
};

export const buildSettingsTree = ({
  config,
  extensionSettings,
  panelType,
  selectedPanelId,
  state,
  topicToSchemaNameMap,
}: BuildSettingsTreeProps): Immutable<SettingsTree> | undefined => {
  if (selectedPanelId == undefined || panelType == undefined) {
    return undefined;
  }

  const set = state.settingsTrees[selectedPanelId];
  if (!set) {
    return undefined;
  }

  const topics = Object.keys(set.nodes.topics?.children ?? {});
  const topicsConfig = maybeCast<{ topics: Record<string, unknown> }>(config)?.topics;
  const topicsSettings = topics.reduce<Record<string, SettingsTreeNode | undefined>>(
    (acc, topic) => {
      const schemaName = topicToSchemaNameMap[topic];
      if (schemaName != undefined) {
        acc[topic] = extensionSettings[panelType]?.[schemaName]?.settings(topicsConfig?.[topic]);
      }
      return acc;
    },
    {},
  );

  return {
    ...set,
    nodes: {
      ...set.nodes,
      topics: {
        ...set.nodes.topics,
        children: _.merge({}, set.nodes.topics?.children, topicsSettings),
      },
    },
  };
};
