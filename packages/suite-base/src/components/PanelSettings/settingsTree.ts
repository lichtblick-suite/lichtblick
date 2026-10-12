// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import * as _ from "lodash-es";

import { Immutable, SettingsTree, SettingsTreeNode } from "@lichtblick/suite";
import { getTopicToSchemaNameMap } from "@lichtblick/suite-base/components/MessagePipeline/selectors";
import { BuildSettingsTreeProps } from "@lichtblick/suite-base/components/PanelSettings/types";
import { maybeCast } from "@lichtblick/suite-base/util/maybeCast";
import {
  getConverterId,
  outputSettingsPath,
  resolveOutputConfig,
} from "@lichtblick/suite-base/util/topicOutput";

export const buildSettingsTree = ({
  config,
  extensionSettings,
  messagePipelineState,
  panelType,
  settingsTree,
  messageConverters,
}: BuildSettingsTreeProps): Immutable<SettingsTree> | undefined => {
  if (panelType == undefined || settingsTree == undefined) {
    return undefined;
  }

  if (settingsTree.topicOutputs != undefined) {
    const nodes = _.cloneDeep(settingsTree.nodes);
    for (const descriptor of settingsTree.topicOutputs) {
      if (descriptor.output.kind !== "converted") {
        continue;
      }
      const converterId = descriptor.output.converterId;
      const settings = messageConverters?.find(
        (converter) => getConverterId(converter) === converterId,
      )?.panelSettings?.[panelType];
      if (settings == undefined) {
        continue;
      }
      const path = outputSettingsPath(descriptor);
      const topicNode = nodes.topics?.children?.[descriptor.topic];
      const outputNode = topicNode?.children?.[path[2]!];
      if (outputNode != undefined) {
        const effectiveConfig = resolveOutputConfig(config, descriptor, settings.defaultConfig);
        _.merge(outputNode, settings.settings(effectiveConfig));
      }
    }
    return { ...settingsTree, nodes };
  }

  const topicToSchemaNameMap = getTopicToSchemaNameMap(messagePipelineState());
  const topics = Object.keys(settingsTree.nodes.topics?.children ?? {});
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
    ...settingsTree,
    nodes: {
      ...settingsTree.nodes,
      topics: {
        ...settingsTree.nodes.topics,
        children: _.merge({}, settingsTree.nodes.topics?.children, topicsSettings),
      },
    },
  };
};
