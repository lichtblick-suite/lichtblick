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

import { Stack } from "@fluentui/react";
import { useCallback, useMemo, useRef } from "react";

import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import TopicToRenderMenu from "@foxglove/studio-base/components/TopicToRenderMenu";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";
import { MessageEvent } from "@foxglove/studio-base/players/types";

import FilterBar, { FilterBarProps } from "./FilterBar";
import LogList from "./LogList";
import LogMessage from "./LogMessage";
import filterMessages from "./filterMessages";
import helpContent from "./index.help.md";
import { RosgraphMsgs$Log } from "./types";

type Config = {
  searchTerms: string[];
  minLogLevel: number;
  topicToRender?: string;
};

type Props = {
  config: Config;
  saveConfig: (arg0: Config) => void;
};

const ROS1_LOG = "rosgraph_msgs/Log";
const ROS2_LOG = "rcl_interfaces/msg/Log";

const LogPanel = React.memo(({ config, saveConfig }: Props) => {
  const { topics } = PanelAPI.useDataSourceInfo();
  const { minLogLevel, searchTerms } = config;
  const { timeFormat, timeZone } = useAppTimeFormat();

  const onFilterChange = useCallback<FilterBarProps["onFilterChange"]>(
    (filter) => {
      saveConfig({ ...config, minLogLevel: filter.minLogLevel, searchTerms: filter.searchTerms });
    },
    [config, saveConfig],
  );

  const defaultTopicToRender = useMemo(
    () =>
      topics.find((topic) => topic.datatype === ROS1_LOG || topic.datatype === ROS2_LOG)?.name ??
      "/rosout",
    [topics],
  );

  const topicToRender = config.topicToRender ?? defaultTopicToRender;

  const { [topicToRender]: messages = [] } = PanelAPI.useMessagesByTopic({
    topics: [topicToRender],
    historySize: 100000,
  }) as { [key: string]: MessageEvent<RosgraphMsgs$Log>[] };

  // avoid making new sets for node names
  // the filter bar uess the node names during on-demand filtering
  const seenNodeNames = useRef(new Set<string>());
  messages.forEach((msg) => seenNodeNames.current.add(msg.message.name));

  const searchTermsSet = useMemo(() => new Set(searchTerms), [searchTerms]);

  const filteredMessages = useMemo(
    () => filterMessages(messages, { minLogLevel, searchTerms }),
    [messages, minLogLevel, searchTerms],
  );

  const topicToRenderMenu = (
    <TopicToRenderMenu
      topicToRender={topicToRender}
      onChange={(newTopicToRender) => saveConfig({ ...config, topicToRender: newTopicToRender })}
      topics={topics}
      allowedDatatypes={[ROS1_LOG, ROS2_LOG]}
      defaultTopicToRender={defaultTopicToRender}
    />
  );

  return (
    <Stack verticalFill>
      <PanelToolbar helpContent={helpContent} additionalIcons={topicToRenderMenu}>
        <FilterBar
          searchTerms={searchTermsSet}
          minLogLevel={minLogLevel}
          nodeNames={seenNodeNames.current}
          messages={filteredMessages}
          onFilterChange={onFilterChange}
        />
      </PanelToolbar>
      <Stack grow>
        <LogList
          items={filteredMessages}
          renderRow={({ item, style, key, ref }) => (
            <div ref={ref} key={key} style={style}>
              <LogMessage msg={item.message} timestampFormat={timeFormat} timeZone={timeZone} />
            </div>
          )}
        />
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
