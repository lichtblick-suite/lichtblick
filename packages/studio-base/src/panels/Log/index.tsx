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

import { Divider } from "@mui/material";
import { produce } from "immer";
import * as _ from "lodash-es";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { SettingsTreeAction } from "@foxglove/studio";
import { useDataSourceInfo, useMessagesByTopic } from "@foxglove/studio-base/PanelAPI";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import { FilterTagInput } from "@foxglove/studio-base/panels/Log/FilterTagInput";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import LogList from "./LogList";
import { normalizedLogMessage } from "./conversion";
import filterMessages from "./filterMessages";
import { buildSettingsTree } from "./settings";
import { Config, LogMessageEvent } from "./types";

type FilterBarProps = {
  searchTerms: Set<string>;
  minLogLevel: number;
  onFilterChange: (filter: { minLogLevel: number; searchTerms: string[] }) => void;
};

function FilterBar(props: FilterBarProps): JSX.Element {
  return (
    <FilterTagInput
      items={[...props.searchTerms]}
      suggestions={[]}
      onChange={(items: string[]) => {
        props.onFilterChange({
          minLogLevel: props.minLogLevel,
          searchTerms: items,
        });
      }}
    />
  );
}

type Props = {
  config: Config;
  saveConfig: SaveConfig<Config>;
};

const SUPPORTED_DATATYPES = [
  "foxglove_msgs/Log",
  "foxglove_msgs/msg/Log",
  "foxglove.Log",
  "foxglove::Log",
  "rcl_interfaces/msg/Log",
  "ros.rcl_interfaces.Log",
  "ros.rosgraph_msgs.Log",
  "rosgraph_msgs/Log",
];

const LogPanel = React.memo(({ config, saveConfig }: Props) => {
  const { topics } = useDataSourceInfo();
  const { minLogLevel, searchTerms, nameFilter } = config;

  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();
  const { t } = useTranslation("log");

  const onFilterChange = useCallback<FilterBarProps["onFilterChange"]>(
    (filter) => {
      saveConfig({ minLogLevel: filter.minLogLevel, searchTerms: filter.searchTerms });
    },
    [saveConfig],
  );

  const availableTopics = useMemo(
    () =>
      topics.filter(
        (topic) => topic.schemaName != undefined && SUPPORTED_DATATYPES.includes(topic.schemaName),
      ),
    [topics],
  );

  const defaultTopicToRender = useMemo(() => availableTopics[0]?.name, [availableTopics]);

  const topicToRender = config.topicToRender ?? defaultTopicToRender ?? "/rosout";

  const { [topicToRender]: messages = [] } = useMessagesByTopic({
    topics: [topicToRender],
    historySize: 100000,
  }) as { [key: string]: LogMessageEvent[] };

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

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action === "update") {
        const { path, value } = action.payload;
        if (path[0] === "nameFilter") {
          saveConfig(produce<Config>((draft) => _.set(draft, path, value)));
        } else {
          saveConfig(produce<Config>((draft) => _.set(draft, path.slice(1), value)));
        }
      } /* perform-node-action */ else {
        if (!["show-all", "hide-all"].includes(action.payload.id)) {
          return;
        }

        const visible = action.payload.id === "show-all";
        saveConfig(
          produce<Config>((draft) => {
            const newNameFilter = Object.fromEntries(
              Object.entries(draft.nameFilter ?? {}).map(([k, _v]) => [k, { visible }]),
            );
            seenNodeNames.forEach((name) => (newNameFilter[name] = { visible }));
            return _.set(draft, ["nameFilter"], newNameFilter);
          }),
        );
      }
    },
    [saveConfig, seenNodeNames],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      enableFilter: true,
      nodes: buildSettingsTree(
        topicToRender,
        minLogLevel,
        nameFilter ?? {},
        availableTopics,
        Array.from(seenNodeNames),
        t,
      ),
    });
  }, [
    actionHandler,
    availableTopics,
    topicToRender,
    minLogLevel,
    nameFilter,
    updatePanelSettingsTree,
    seenNodeNames,
    seenNodeNames.size, // Needed as we do not create a new Set when node names change
    t,
  ]);

  const searchTermsSet = useMemo(() => new Set(searchTerms), [searchTerms]);

  const filteredMessages = useMemo(
    () =>
      filterMessages(messages, {
        minLogLevel,
        searchTerms,
        nameFilter: nameFilter ?? {},
      }),
    [messages, minLogLevel, searchTerms, nameFilter],
  );

  const normalizedMessages = useMemo(
    () => filteredMessages.map((msg) => normalizedLogMessage(msg.schemaName, msg["message"])),
    [filteredMessages],
  );

  return (
    <Stack fullHeight>
      <PanelToolbar />
      <Stack flexGrow={0} padding={0.5}>
        <FilterBar
          searchTerms={searchTermsSet}
          minLogLevel={minLogLevel}
          onFilterChange={onFilterChange}
        />
      </Stack>
      <Divider />
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
