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
import React, { PureComponent } from "react";
import { Creatable as ReactSelectCreatable } from "react-select";
import VirtualizedSelect from "react-virtualized-select";
import { createSelector } from "reselect";
import { $ReadOnly } from "utility-types";

import LevelToString, { KNOWN_LOG_LEVELS } from "./LevelToString";
import LogMessage from "./LogMessage";
import logStyle from "./LogMessage.module.scss";
import helpContent from "./index.help.md";
import styles from "./index.module.scss";
import Flex from "@foxglove-studio/app/components/Flex";
import Icon from "@foxglove-studio/app/components/Icon";
import LogList from "@foxglove-studio/app/components/LogList";
import MessageHistoryDEPRECATED, {
  MessageHistoryData,
  MessageHistoryItem,
} from "@foxglove-studio/app/components/MessageHistoryDEPRECATED";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import TopicToRenderMenu from "@foxglove-studio/app/components/TopicToRenderMenu";
import { cast, ReflectiveMessage, Topic } from "@foxglove-studio/app/players/types";
import { Header } from "@foxglove-studio/app/types/Messages";
import clipboard from "@foxglove-studio/app/util/clipboard";
import { ROSOUT_TOPIC } from "@foxglove-studio/app/util/globalConstants";

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

type RosgraphMsgs$Log = $ReadOnly<{
  header: Header;
  level: number;
  name: string;
  msg: string;
  file: string;
  function: string;
  line: number;
  topics: ReadonlyArray<string>;
}>;

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

class RosoutPanel extends PureComponent<Props> {
  static defaultConfig = { searchTerms: [], minLogLevel: 1, topicToRender: ROSOUT_TOPIC };
  static panelType = "RosOut";

  _onNodeFilterChange = (selectedOptions: Option[]) => {
    this.props.saveConfig({
      ...this.props.config,
      searchTerms: selectedOptions.map((option) => option.value),
    });
  };

  _onLogLevelChange = (minLogLevel: number) => {
    this.props.saveConfig({ ...this.props.config, minLogLevel });
  };

  _filterFn = (item: MessageHistoryItem) =>
    getShouldDisplayMsg(item.message, this.props.config.minLogLevel, this.props.config.searchTerms);

  _getFilteredMessages(
    items: ReadonlyArray<MessageHistoryItem>,
  ): ReadonlyArray<MessageHistoryItem> {
    const { minLogLevel, searchTerms } = this.props.config;
    const hasActiveFilters = minLogLevel > 1 || searchTerms.length > 0;
    if (!hasActiveFilters) {
      // This early return avoids looping over the full list with a filter that will always return true.
      return items;
    }
    return items.filter(this._filterFn);
  }

  _renderFiltersBar = (seenNodeNames: Set<string>, msgs: ReadonlyArray<MessageHistoryItem>) => {
    const { minLogLevel, searchTerms } = this.props.config;
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
              onClick={() => this._onLogLevelChange(option.value)}
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
          onChange={this._onNodeFilterChange as any}
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
              clipboard.copy(JSON.stringify(msgs, null, 2));
            }}
            tooltip="Copy rosout to clipboard"
          >
            <ClipboardOutlineIcon />
          </Icon>
        </div>
      </div>
    );
  };
  _renderRow({ item, style, key, index }: any) {
    return (
      <div key={key} style={index === 0 ? { ...style, paddingTop: 36 } : style}>
        <LogMessage msg={item.message.message} />
      </div>
    );
  }

  render() {
    const { topics, config } = this.props;
    const seenNodeNames = new Set();

    const topicToRenderMenu = (
      <TopicToRenderMenu
        topicToRender={config.topicToRender}
        onChange={(topicToRender) => this.props.saveConfig({ ...this.props.config, topicToRender })}
        topics={topics}
        singleTopicDatatype="rosgraph_msgs/Log"
        defaultTopicToRender={ROSOUT_TOPIC}
      />
    );

    return (
      <MessageHistoryDEPRECATED paths={[config.topicToRender]} historySize={100000}>
        {({ itemsByPath }: MessageHistoryData) => {
          const msgs: ReadonlyArray<MessageHistoryItem> = itemsByPath[config.topicToRender];
          msgs.forEach((msg) =>
            seenNodeNames.add(cast<RosgraphMsgs$Log>(msg.message.message).name),
          );

          return (
            <Flex col>
              <PanelToolbar floating helpContent={helpContent} additionalIcons={topicToRenderMenu}>
                {this._renderFiltersBar(seenNodeNames as any, msgs)}
              </PanelToolbar>
              <div className={styles.content}>
                <LogList items={this._getFilteredMessages(msgs)} renderRow={this._renderRow} />
              </div>
            </Flex>
          );
        }}
      </MessageHistoryDEPRECATED>
    );
  }
}

export default Panel<Config>(RosoutPanel as any);
