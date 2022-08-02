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
  ISelectableOption,
  useTheme,
  IDropdownStyles,
} from "@fluentui/react";
import CopyAllIcon from "@mui/icons-material/CopyAll";
import { useTheme as useMuiTheme } from "@mui/material";
import cx from "classnames";
import { useMemo } from "react";

import ToolbarIconButton from "@foxglove/studio-base/components/PanelToolbar/ToolbarIconButton";
import Stack from "@foxglove/studio-base/components/Stack";
import useLogStyles from "@foxglove/studio-base/panels/Log/useLogStyles";
import clipboard from "@foxglove/studio-base/util/clipboard";

import LevelToString from "./LevelToString";
import { LogMessageEvent, LogLevel } from "./types";

// Create the log level options nodes once since they don't change per render.
const LOG_LEVEL_OPTIONS: IDropdownOption[] = [
  { text: ">= DEBUG", key: LogLevel.DEBUG },
  { text: ">= INFO", key: LogLevel.INFO },
  { text: ">= WARN", key: LogLevel.WARN },
  { text: ">= ERROR", key: LogLevel.ERROR },
  { text: ">= FATAL", key: LogLevel.FATAL },
];

type Filter = {
  minLogLevel: number;
  searchTerms: string[];
};

export type FilterBarProps = {
  searchTerms: Set<string>;
  nodeNames: Set<string>;
  minLogLevel: number;
  messages: readonly LogMessageEvent[];

  onFilterChange: (filter: Filter) => void;
};

// custom renderer for item in dropdown list to color text
function renderOption(
  option: ISelectableOption | undefined,
  logStyles: ReturnType<typeof useLogStyles>["classes"],
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
  logStyles: ReturnType<typeof useLogStyles>["classes"],
) {
  if (!options) {
    return ReactNull;
  }
  return <>{options.map((option) => renderOption(option, logStyles))}</>;
}

export default function FilterBar(props: FilterBarProps): JSX.Element {
  const { classes: logStyles } = useLogStyles();
  const nodeNameOptions = Array.from(props.nodeNames, (name) => ({ name, key: name }));

  const selectedItems = Array.from(props.searchTerms, (term) => ({
    name: term,
    key: term,
  }));
  const theme = useTheme();
  const muiTheme = useMuiTheme();
  const dropdownStyles: Partial<IDropdownStyles> = useMemo(
    () => ({
      root: {
        minWidth: "100px",
      },
      caretDownWrapper: {
        top: 0,
        lineHeight: 16,
        height: 16,
      },
      title: {
        backgroundColor: "transparent",
        fontSize: theme.fonts.small.fontSize,
        borderColor: theme.semanticColors.bodyDivider,
        lineHeight: 22,
        height: 22,
      },
      dropdownItemSelected: {
        fontSize: theme.fonts.small.fontSize,
        lineHeight: 22,
        height: 22,
        minHeight: 22,
      },
      dropdownItem: {
        lineHeight: 22,
        height: 22,
        minHeight: 22,
        fontSize: theme.fonts.small.fontSize,
      },
    }),
    [theme],
  );

  return (
    <Stack
      flex="auto"
      direction="row"
      gap={0.5}
      alignItems="center"
      style={{ marginRight: muiTheme.spacing(-1) }} // Spacing hack until we can unify the toolbar items.
    >
      <Dropdown
        styles={dropdownStyles}
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
      <Stack flex="auto" gap={1}>
        <TagPicker
          inputProps={{
            placeholder: "Search filter",
          }}
          styles={{
            text: { minWidth: 0, minHeight: 22 },
            input: {
              width: 0,
              height: 20,
              fontSize: 11,

              "::placeholder": {
                fontSize: 11,
              },
            },
            root: { height: 22 },
            itemsWrapper: {
              ".ms-TagItem": { lineHeight: 16, height: 16, fontSize: 11 },
              ".ms-TagItem-text": { margin: "0 4px" },
              ".ms-TagItem-close": {
                fontSize: 11,
                width: 20,

                ".ms-Button-icon": {
                  margin: 0,
                },
              },
            },
          }}
          removeButtonAriaLabel="Remove"
          selectionAriaLabel="Filter"
          resolveDelay={50}
          selectedItems={selectedItems}
          onResolveSuggestions={(filter: string) => {
            return [
              { name: filter, key: filter },
              ...nodeNameOptions.filter(({ key }) =>
                selectedItems.every((item) => item.key !== key),
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
      <Stack direction="row" alignItems="center" gap={0.5}>
        <ToolbarIconButton
          onClick={() => {
            void clipboard.copy(JSON.stringify(props.messages, undefined, 2) ?? "");
          }}
          title="Copy log to clipboard"
        >
          <CopyAllIcon />
        </ToolbarIconButton>
      </Stack>
    </Stack>
  );
}
