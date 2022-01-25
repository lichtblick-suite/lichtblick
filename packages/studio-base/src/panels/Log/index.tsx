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

import { IconButton, IList, List } from "@fluentui/react";
import { Box, Stack } from "@mui/material";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import TopicToRenderMenu from "@foxglove/studio-base/components/TopicToRenderMenu";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";
import { MessageEvent } from "@foxglove/studio-base/players/types";

import FilterBar, { FilterBarProps } from "./FilterBar";
import LogMessage from "./LogMessage";
import filterMessages from "./filterMessages";
import helpContent from "./index.help.md";
import { RosgraphMsgs$Log } from "./types";

type ArrayElementType<T extends readonly unknown[]> = T extends readonly (infer E)[] ? E : never;

type Config = {
  searchTerms: string[];
  minLogLevel: number;
  topicToRender?: string;
};

type Props = {
  config: Config;
  saveConfig: (arg0: Config) => void;
};

const SUPPORTED_DATATYPES = [
  "rosgraph_msgs/Log",
  "rcl_interfaces/msg/Log",
  "ros.rosgraph_msgs.Log",
  "ros.rcl_interfaces.Log",
];

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
    () => topics.find((topic) => SUPPORTED_DATATYPES.includes(topic.datatype))?.name ?? "/rosout",
    [topics],
  );

  const topicToRender = config.topicToRender ?? defaultTopicToRender;

  const { [topicToRender]: messages = [] } = PanelAPI.useMessagesByTopic({
    topics: [topicToRender],
    historySize: 100000,
  }) as { [key: string]: MessageEvent<RosgraphMsgs$Log>[] };

  // avoid making new sets for node names
  // the filter bar uess the node names during on-demand filtering
  const seenNodeNamesCache = useRef(new Set<string>());

  const seenNodeNames = useMemo(() => {
    for (const msg of messages) {
      seenNodeNamesCache.current.add(msg.message.name);
    }

    return seenNodeNamesCache.current;
  }, [messages]);

  const searchTermsSet = useMemo(() => new Set(searchTerms), [searchTerms]);

  const filteredMessages = useMemo(
    () => filterMessages(messages, { minLogLevel, searchTerms }),
    [messages, minLogLevel, searchTerms],
  );

  const listRef = useRef<IList>(ReactNull);

  const topicToRenderMenu = (
    <TopicToRenderMenu
      topicToRender={topicToRender}
      onChange={(newTopicToRender) => saveConfig({ ...config, topicToRender: newTopicToRender })}
      topics={topics}
      allowedDatatypes={SUPPORTED_DATATYPES}
      defaultTopicToRender={defaultTopicToRender}
    />
  );

  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  const scrollByUpdate = useRef<boolean>(false);

  const divRef = useRef<HTMLDivElement>(ReactNull);

  function scrollToBottom() {
    const div = divRef.current;
    if (!div) {
      return;
    }

    div.scrollTop = div.scrollHeight;
  }

  function scrollToBottomAction() {
    setHasUserScrolled(false);
    scrollByUpdate.current = true;
    scrollToBottom();
  }

  useLayoutEffect(() => {
    const div = divRef.current;
    if (!div) {
      return;
    }

    const listener = () => {
      if (!scrollByUpdate.current) {
        setHasUserScrolled(true);
      }
      scrollByUpdate.current = false;
    };

    div.addEventListener("scroll", listener);
    return () => {
      div.removeEventListener("scroll", listener);
    };
  }, []);

  return (
    <Stack height="100%">
      <PanelToolbar helpContent={helpContent} additionalIcons={topicToRenderMenu}>
        <FilterBar
          searchTerms={searchTermsSet}
          minLogLevel={minLogLevel}
          nodeNames={seenNodeNames}
          messages={filteredMessages}
          onFilterChange={onFilterChange}
        />
      </PanelToolbar>
      <Stack flexGrow={1} overflow="hidden">
        <Box ref={divRef} height="100%" overflow="auto">
          {/* items property wants a mutable array but filteredMessages is readonly */}
          <List
            componentRef={listRef}
            items={filteredMessages as ArrayElementType<typeof filteredMessages>[]}
            onPagesUpdated={() => {
              // If the user has scrolled manually then we avoid automatic scrolling
              if (!hasUserScrolled) {
                scrollByUpdate.current = true;
                scrollToBottom();
              }
            }}
            onRenderCell={(item) => {
              if (!item) {
                return;
              }

              return (
                <LogMessage msg={item.message} timestampFormat={timeFormat} timeZone={timeZone} />
              );
            }}
          />
        </Box>
      </Stack>
      {hasUserScrolled && (
        <Box position="absolute" bottom={10} right={10}>
          <IconButton
            iconProps={{ iconName: "DoubleChevronDown" }}
            title="Scroll to bottom"
            onClick={scrollToBottomAction}
          />
        </Box>
      )}
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
