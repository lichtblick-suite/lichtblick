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

import { List, IList } from "@fluentui/react/lib/List";
import DoubleArrowDownIcon from "@mui/icons-material/KeyboardDoubleArrowDown";
import { Fab } from "@mui/material";
import produce from "immer";
import { set } from "lodash";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { SettingsTreeAction } from "@foxglove/studio";
import { useDataSourceInfo, useMessagesByTopic } from "@foxglove/studio-base/PanelAPI";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelSettingsEditorContextProvider";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import FilterBar, { FilterBarProps } from "./FilterBar";
import LogMessage from "./LogMessage";
import { normalizedLogMessage } from "./conversion";
import filterMessages from "./filterMessages";
import helpContent from "./index.help.md";
import { buildSettingsTree } from "./settings";
import { Config, LogMessageEvent } from "./types";

type ArrayElementType<T extends readonly unknown[]> = T extends readonly (infer E)[] ? E : never;

type Props = {
  config: Config;
  saveConfig: SaveConfig<Config>;
};

const SUPPORTED_DATATYPES = [
  "rosgraph_msgs/Log",
  "rcl_interfaces/msg/Log",
  "ros.rosgraph_msgs.Log",
  "ros.rcl_interfaces.Log",
  "foxglove_msgs/Log",
  "foxglove_msgs/msg/Log",
  "foxglove.Log",
];

const useStyles = makeStyles()((theme) => ({
  floatingButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    margin: theme.spacing(1.5),
  },
}));

const LogPanel = React.memo(({ config, saveConfig }: Props) => {
  const { classes } = useStyles();
  const { topics } = useDataSourceInfo();
  const { minLogLevel, searchTerms } = config;
  const { timeFormat, timeZone } = useAppTimeFormat();

  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

  const onFilterChange = useCallback<FilterBarProps["onFilterChange"]>(
    (filter) => saveConfig({ minLogLevel: filter.minLogLevel, searchTerms: filter.searchTerms }),
    [saveConfig],
  );

  // Get the topics that have our supported datatypes
  // Users can select any of these topics for display in the panel
  const availableTopics = useMemo(
    () => topics.filter((topic) => SUPPORTED_DATATYPES.includes(topic.datatype)),
    [topics],
  );

  // Pick the first available topic, if there are not available topics, then we inform the user
  // nothing is publishing log messages
  const defaultTopicToRender = useMemo(() => availableTopics[0]?.name, [availableTopics]);

  const topicToRender = config.topicToRender ?? defaultTopicToRender ?? "/rosout";

  const { [topicToRender]: msgEvents = [] } = useMessagesByTopic({
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
  // the filter bar uses the node names during on-demand filtering
  const seenNodeNamesCache = useRef(new Set<string>());

  const seenNodeNames = useMemo(() => {
    for (const msgEvent of msgEvents) {
      const name = msgEvent.message.name;
      if (name != undefined) {
        seenNodeNamesCache.current.add(name);
      }
    }

    return seenNodeNamesCache.current;
  }, [msgEvents]);

  const searchTermsSet = useMemo(() => new Set(searchTerms), [searchTerms]);

  const filteredMessages = useMemo(
    () => filterMessages(msgEvents, { minLogLevel, searchTerms }),
    [msgEvents, minLogLevel, searchTerms],
  );

  const listRef = useRef<IList>(ReactNull);

  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  const divRef = useRef<HTMLDivElement>(ReactNull);

  const scrollToBottomAction = useCallback(() => {
    const div = divRef.current;
    if (!div) {
      return;
    }

    setHasUserScrolled(false);
    // With column-reverse flex direction, 0 scroll top is the bottom (latest) message
    div.scrollTop = 0;
  }, []);

  useLayoutEffect(() => {
    const div = divRef.current;
    if (!div) {
      return;
    }

    const listener = () => {
      setHasUserScrolled(div.scrollTop !== 0);
    };

    div.addEventListener("scroll", listener);
    return () => {
      div.removeEventListener("scroll", listener);
    };
  }, []);

  return (
    <Stack fullHeight>
      <PanelToolbar helpContent={helpContent}>
        <FilterBar
          searchTerms={searchTermsSet}
          minLogLevel={minLogLevel}
          nodeNames={seenNodeNames}
          messages={filteredMessages}
          onFilterChange={onFilterChange}
        />
      </PanelToolbar>
      <Stack flexGrow={1} overflow="hidden">
        <Stack
          ref={divRef}
          fullHeight
          overflowY="auto"
          direction="column-reverse"
          data-testid="log-messages-list"
        >
          {/* items property wants a mutable array but filteredMessages is readonly */}
          <List
            componentRef={listRef}
            items={filteredMessages as ArrayElementType<typeof filteredMessages>[]}
            onRenderCell={(item) => {
              if (!item) {
                return;
              }

              const normalizedLog = normalizedLogMessage(item.schemaName, item["message"]);
              return (
                <LogMessage
                  value={normalizedLog}
                  timestampFormat={timeFormat}
                  timeZone={timeZone}
                />
              );
            }}
          />
        </Stack>
      </Stack>
      {hasUserScrolled && (
        <Fab
          size="small"
          title="Scroll to bottom"
          onClick={scrollToBottomAction}
          className={classes.floatingButton}
        >
          <DoubleArrowDownIcon />
        </Fab>
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
