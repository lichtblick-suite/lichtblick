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

import {
  Dropdown,
  IDropdownOption,
  TagPicker,
  Stack,
  ISelectableOption,
  useTheme,
} from "@fluentui/react";
import ClipboardOutlineIcon from "@mdi/svg/svg/clipboard-outline.svg";
import cx from "classnames";

import Icon from "@foxglove/studio-base/components/Icon";
import useLogStyles from "@foxglove/studio-base/panels/Rosout/useLogStyles";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import clipboard from "@foxglove/studio-base/util/clipboard";

import LevelToString, { KNOWN_LOG_LEVELS } from "./LevelToString";
import { RosgraphMsgs$Log } from "./types";

// Create the log level options nodes once since they don't change per render.
const LOG_LEVEL_OPTIONS = KNOWN_LOG_LEVELS.map<IDropdownOption>((level) => ({
  text: `>= ${LevelToString(level)}`,
  key: level,
}));

type Filter = {
  minLogLevel: number;
  searchTerms: string[];
};

export type FilterBarProps = {
  searchTerms: Set<string>;
  nodeNames: Set<string>;
  minLogLevel: number;
  messages: readonly MessageEvent<RosgraphMsgs$Log>[];

  onFilterChange: (filter: Filter) => void;
};

// custom renderer for item in dropdown list to color text
function renderOption(
  option: ISelectableOption | undefined,
  logStyles: ReturnType<typeof useLogStyles>,
) {
  if (!option) {
    return ReactNull;
  }
  const strLevel = LevelToString(option.key as number);

  return (
    <div
      key={option.key}
      className={cx({
        [logStyles.fatal]: strLevel === "FATAL",
        [logStyles.error]: strLevel === "ERROR",
        [logStyles.warn]: strLevel === "WARN",
        [logStyles.info]: strLevel === "INFO",
        [logStyles.debug]: strLevel === "DEBUG",
      })}
    >
      {option.text}
    </div>
  );
}

// custom renderer for selected dropdown item to color the text
function renderTitle(
  options: IDropdownOption[] | undefined,
  logStyles: ReturnType<typeof useLogStyles>,
) {
  if (!options) {
    return ReactNull;
  }
  return <>{options.map((option) => renderOption(option, logStyles))}</>;
}

export default function FilterBar(props: FilterBarProps): JSX.Element {
  const nodeNameOptions = Array.from(props.nodeNames, (name) => ({ name, key: name }));

  const selectedItems = Array.from(props.searchTerms, (term) => ({
    name: term,
    key: term,
  }));
  const theme = useTheme();
  const logStyles = useLogStyles();
  return (
    <Stack grow horizontal tokens={{ childrenGap: theme.spacing.s1 }}>
      <Dropdown
        styles={{ title: { background: "transparent" } }}
        onRenderOption={(option) => renderOption(option, logStyles)}
        onRenderTitle={(options) => renderTitle(options, logStyles)}
        onChange={(_ev, option) => {
          if (option) {
            props.onFilterChange({
              minLogLevel: option.key as number,
              searchTerms: Array.from(props.searchTerms),
            });
          }
        }}
        options={LOG_LEVEL_OPTIONS}
        selectedKey={props.minLogLevel}
      />

      <Stack grow>
        <TagPicker
          inputProps={{
            placeholder: "Node name or message text",
          }}
          styles={{
            text: { minWidth: 0 },
            input: { width: 0 },
          }}
          removeButtonAriaLabel="Remove"
          selectionAriaLabel="Filter"
          resolveDelay={50}
          selectedItems={selectedItems}
          onResolveSuggestions={(filter: string) => {
            return [
              { name: filter, key: filter },
              ...nodeNameOptions.filter(
                ({ key }) => selectedItems?.every((item) => item.key !== key) ?? true,
              ),
            ];
          }}
          onChange={(items) => {
            props.onFilterChange({
              minLogLevel: props.minLogLevel,
              searchTerms: items?.map((item) => item.name) ?? [],
            });
          }}
        />
      </Stack>
      <Stack verticalAlign="center">
        <div
          style={{
            whiteSpace: "nowrap",
            padding: "0px 8px",
            color: theme.palette.neutralTertiary,
          }}
        >
          {props.messages.length} {props.messages.length === 1 ? "item" : "items"}
          <Icon
            style={{ padding: "1px 0px 0px 6px" }}
            onClick={() => {
              void clipboard.copy(JSON.stringify(props.messages, undefined, 2));
            }}
            tooltip="Copy rosout to clipboard"
          >
            <ClipboardOutlineIcon />
          </Icon>
        </div>
      </Stack>
    </Stack>
  );
}
