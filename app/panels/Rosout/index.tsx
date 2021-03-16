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

import ClipboardOutlineIcon from "@mdi/svg/svg/clipboard-outline.svg";
import cx from "classnames";
import { Creatable as ReactSelectCreatable } from "react-select";
import VirtualizedSelect from "react-virtualized-select";
import { createSelector } from "reselect";

import * as PanelAPI from "@foxglove-studio/app/PanelAPI";
import Flex from "@foxglove-studio/app/components/Flex";
import Icon from "@foxglove-studio/app/components/Icon";
import LogList from "@foxglove-studio/app/components/LogList";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import TopicToRenderMenu from "@foxglove-studio/app/components/TopicToRenderMenu";
import { cast, ReflectiveMessage, Topic, TypedMessage } from "@foxglove-studio/app/players/types";
import { RosgraphMsgs$Log } from "@foxglove-studio/app/types/Messages";
import clipboard from "@foxglove-studio/app/util/clipboard";
import { ROSOUT_TOPIC } from "@foxglove-studio/app/util/globalConstants";

import LevelToString, { KNOWN_LOG_LEVELS } from "./LevelToString";
import LogMessage from "./LogMessage";
import logStyle from "./LogMessage.module.scss";
import helpContent from "./index.help.md";
import styles from "./index.module.scss";

// Remove creatable warning https://github.com/JedWatson/react-select/issues/2181
class Creatable extends React.Component {
  render() {
    return <ReactSelectCreatable {...this.props} />;
  }
}

type Option = {
  value: any;
  label: string;
};

// Create the log level options nodes once since they don't change per render.
const LOG_LEVEL_OPTIONS = KNOWN_LOG_LEVELS.map((level) => ({
  label: `>= ${LevelToString(level)}`,
  value: level,
}));

// Persist the identity of selectedOptions for React Creatable.
// Without it, we can't create new options.
export const stringsToOptions = createSelector<any, any, any, unknown>(
  (strs: string[]) => strs,
  (strs: string[]): Option[] => strs.map((value) => ({ label: value, value })),
);

export const getShouldDisplayMsg = (
  message: ReflectiveMessage,
  minLogLevel: number,
  searchTerms: string[],
): boolean => {
  const logMessage = cast<RosgraphMsgs$Log>(message.message);
  if (logMessage.level < minLogLevel) {
    return false;
  }

  if (searchTerms.length < 1) {
    // No search term filters so this message should be visible.
    return true;
  }
  const searchTermsInLowerCase = searchTerms.map((term) => term.toLowerCase());
  const { name, msg } = logMessage;
  const lowerCaseName = name.toLowerCase();
  const lowerCaseMsg = msg.toLowerCase();
  return searchTermsInLowerCase.some(
    (term) => lowerCaseName.includes(term) || lowerCaseMsg.includes(term),
  );
};

type Config = {
  searchTerms: string[];
  minLogLevel: number;
  topicToRender: string;
};

type Props = {
  config: Config;
  saveConfig: (arg0: Config) => void;
  topics: Topic[];
};

const RosoutPanel = React.memo(({ config, saveConfig, topics }: Props) => {
  const onNodeFilterChange = (selectedOptions: Option[]) => {
    saveConfig({
      ...config,
      searchTerms: selectedOptions.map((option) => option.value),
    });
  };

  const onLogLevelChange = (minLogLevel: number) => {
    saveConfig({ ...config, minLogLevel });
  };

  const filterFn = (item: TypedMessage<RosgraphMsgs$Log>) =>
    getShouldDisplayMsg(item, config.minLogLevel, config.searchTerms);

  function getFilteredMessages(items: readonly TypedMessage<RosgraphMsgs$Log>[]) {
    const { minLogLevel, searchTerms } = config;
    const hasActiveFilters = minLogLevel > 1 || searchTerms.length > 0;
    if (!hasActiveFilters) {
      // This early return avoids looping over the full list with a filter that will always return true.
      return items;
    }
    return items.filter(filterFn);
  }

  const renderFiltersBar = (
    seenNodeNames: Set<string>,
    msgs: readonly TypedMessage<RosgraphMsgs$Log>[],
  ) => {
    const { minLogLevel, searchTerms } = config;
    const nodeNameOptions = Array.from(seenNodeNames).map((name) => ({ label: name, value: name }));

    return (
      <div className={styles.filtersBar}>
        <VirtualizedSelect
          className={cx(styles.severityFilter)}
          clearable={false}
          searchable={false}
          value={minLogLevel}
          optionHeight={parseInt(styles.optionHeight)}
          maxHeight={parseInt(styles.optionHeight) * KNOWN_LOG_LEVELS.length}
          options={LOG_LEVEL_OPTIONS}
          optionRenderer={({ key, style: styleProp, option, focusedOption }: any) => (
            <div
              className={cx(
                logStyle[LevelToString(option.value).toLowerCase()],
                "VirtualizedSelectOption",
                {
                  VirtualizedSelectFocusedOption: focusedOption === option,
                },
              )}
              style={styleProp}
              onClick={() => onLogLevelChange(option.value)}
              key={key}
            >
              {option.label}
            </div>
          )}
          valueComponent={(option) => (
            <span>{`Min Severity: ${LevelToString(option.value.value as any)}`}</span>
          )}
        />
        <VirtualizedSelect
          className={styles.nodeFilter}
          clearable
          multi
          closeOnSelect={false}
          value={stringsToOptions(searchTerms, undefined) as any}
          onChange={onNodeFilterChange as any}
          options={nodeNameOptions}
          optionHeight={parseInt(styles.optionHeight)}
          placeholder="Filter by node name or message text"
          searchable
          selectComponent={Creatable}
          promptTextCreator={(label) => `Node names or msgs containing "${label}"`}
        />
        <div className={styles.itemsCountField}>
          {msgs.length} {msgs.length === 1 ? "item" : "items"}
          <Icon
            style={{ padding: "1px 0px 0px 6px" }}
            onClick={() => {
              clipboard.copy(JSON.stringify(msgs, undefined, 2));
            }}
            tooltip="Copy rosout to clipboard"
          >
            <ClipboardOutlineIcon />
          </Icon>
        </div>
      </div>
    );
  };

  const topicToRenderMenu = (
    <TopicToRenderMenu
      topicToRender={config.topicToRender}
      onChange={(topicToRender) => saveConfig({ ...config, topicToRender })}
      topics={topics}
      singleTopicDatatype="rosgraph_msgs/Log"
      defaultTopicToRender={ROSOUT_TOPIC}
    />
  );

  const { [config.topicToRender]: messages = [] } = PanelAPI.useMessagesByTopic<RosgraphMsgs$Log>({
    topics: [config.topicToRender],
    historySize: 100000,
  });

  const seenNodeNames = new Set<string>();
  messages.forEach((msg) => seenNodeNames.add(msg.message.name));

  return (
    <Flex col>
      <PanelToolbar floating helpContent={helpContent} additionalIcons={topicToRenderMenu}>
        {renderFiltersBar(seenNodeNames, messages)}
      </PanelToolbar>
      <div className={styles.content}>
        <LogList
          items={getFilteredMessages(messages)}
          renderRow={({ item, style, key, index }) => (
            <div key={key} style={index === 0 ? { ...style, paddingTop: 36 } : style}>
              <LogMessage msg={item.message} />
            </div>
          )}
        />
      </div>
    </Flex>
  );
});

export default Panel<Config>(
  Object.assign(RosoutPanel, {
    defaultConfig: { searchTerms: [], minLogLevel: 1, topicToRender: ROSOUT_TOPIC },
    panelType: "RosOut",
  }) as any,
);
