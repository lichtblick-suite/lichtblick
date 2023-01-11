// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import produce from "immer";
import { set } from "lodash";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { SettingsTreeAction } from "@foxglove/studio";
import { useDataSourceInfo, useMessagesByTopic } from "@foxglove/studio-base/PanelAPI";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import FilterBar, { FilterBarProps } from "./FilterBar";
import LogList from "./LogList";
import { normalizedLogMessage } from "./conversion";
import filterMessages from "./filterMessages";
import { buildSettingsTree } from "./settings";
import { Config, LogMessageEvent } from "./types";

type Props = {
  config: Config;
  saveConfig: SaveConfig<Config>;
};

const SUPPORTED_DATATYPES = [
  "foxglove_msgs/Log",
  "foxglove_msgs/msg/Log",
  "foxglove.Log",
  "rcl_interfaces/msg/Log",
  "ros.rcl_interfaces.Log",
  "ros.rosgraph_msgs.Log",
  "rosgraph_msgs/Log",
];

const LogPanel = React.memo(({ config, saveConfig }: Props) => {
  const { topics } = useDataSourceInfo();
  const { minLogLevel, searchTerms } = config;

  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

  const onFilterChange = useCallback<FilterBarProps["onFilterChange"]>(
    (filter) => {
      saveConfig({ minLogLevel: filter.minLogLevel, searchTerms: filter.searchTerms });
    },
    [saveConfig],
  );

  const availableTopics = useMemo(
    () => topics.filter((topic) => SUPPORTED_DATATYPES.includes(topic.schemaName)),
    [topics],
  );

  const defaultTopicToRender = useMemo(() => availableTopics[0]?.name, [availableTopics]);

  const topicToRender = config.topicToRender ?? defaultTopicToRender ?? "/rosout";

  const { [topicToRender]: messages = [] } = useMessagesByTopic({
    topics: [topicToRender],
    historySize: 100000,
  }) as { [key: string]: LogMessageEvent[] };

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      const { path, value } = action.payload;
      saveConfig(produce<Config>((draft) => set(draft, path.slice(1), value)));
    },
    [saveConfig],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      nodes: buildSettingsTree(topicToRender, availableTopics),
    });
  }, [actionHandler, availableTopics, topicToRender, updatePanelSettingsTree]);

  // avoid making new sets for node names
  // the filter bar uess the node names during on-demand filtering
  // the filter bar uses the node names during on-demand filtering
  const seenNodeNamesCache = useRef(new Set<string>());

  const seenNodeNames = useMemo(() => {
    for (const msgEvent of messages) {
      const name = msgEvent.message.name;
      if (name != undefined) {
        seenNodeNamesCache.current.add(name);
      }
    }

    return seenNodeNamesCache.current;
  }, [messages]);

  const searchTermsSet = useMemo(() => new Set(searchTerms), [searchTerms]);

  const filteredMessages = useMemo(
    () => filterMessages(messages, { minLogLevel, searchTerms }),
    [messages, minLogLevel, searchTerms],
  );

  const normalizedMessages = useMemo(
    () => filteredMessages.map((msg) => normalizedLogMessage(msg.schemaName, msg["message"])),
    [filteredMessages],
  );

  return (
    <Stack fullHeight>
      <PanelToolbar>
        <FilterBar
          searchTerms={searchTermsSet}
          minLogLevel={minLogLevel}
          nodeNames={seenNodeNames}
          messages={filteredMessages}
          onFilterChange={onFilterChange}
        />
      </PanelToolbar>
      <Stack flexGrow={1}>
        <LogList items={normalizedMessages} />
      </Stack>
    </Stack>
  );
});

LogPanel.displayName = "Log";

export default Panel(
  Object.assign(LogPanel, {
    defaultConfig: { searchTerms: [], minLogLevel: 1 } as Config,
    panelType: "RosOut", // The legacy RosOut name is used for backwards compatibility
  }),
);
