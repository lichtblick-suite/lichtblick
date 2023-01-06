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

import CopyAllIcon from "@mui/icons-material/CopyAll";
import { MenuItem, Select, Typography } from "@mui/material";
import { useCallback } from "react";
import { makeStyles } from "tss-react/mui";

import ToolbarIconButton from "@foxglove/studio-base/components/PanelToolbar/ToolbarIconButton";
import Stack from "@foxglove/studio-base/components/Stack";
import { FilterTagInput } from "@foxglove/studio-base/panels/Log/FilterTagInput";
import useLogStyles from "@foxglove/studio-base/panels/Log/useLogStyles";
import clipboard from "@foxglove/studio-base/util/clipboard";

import LevelToString from "./LevelToString";
import { LogMessageEvent, LogLevel } from "./types";

// Create the log level options nodes once since they don't change per render.
const LOG_LEVEL_OPTIONS = [
  { text: ">= DEBUG", key: LogLevel.DEBUG },
  { text: ">= INFO", key: LogLevel.INFO },
  { text: ">= WARN", key: LogLevel.WARN },
  { text: ">= ERROR", key: LogLevel.ERROR },
  { text: ">= FATAL", key: LogLevel.FATAL },
];

const useStyles = makeStyles()((theme) => ({
  root: {
    marginRight: theme.spacing(-1),
  },
  levelSelect: {
    ".MuiSelect-select.MuiInputBase-inputSizeSmall": {
      paddingBottom: `${theme.spacing(0.375)} !important`,
      paddingTop: `${theme.spacing(0.375)} !important`,
    },
  },
}));

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

export default function FilterBar(props: FilterBarProps): JSX.Element {
  const { classes: logStyles } = useLogStyles();
  const { classes, cx } = useStyles();

  const logLevelToClass = useCallback(
    (level: number) => {
      const strLevel = LevelToString(level);
      return cx({
        [logStyles.fatal]: strLevel === "FATAL",
        [logStyles.error]: strLevel === "ERROR",
        [logStyles.warn]: strLevel === "WARN",
        [logStyles.info]: strLevel === "INFO",
        [logStyles.debug]: strLevel === "DEBUG",
      });
    },
    [cx, logStyles.debug, logStyles.error, logStyles.fatal, logStyles.info, logStyles.warn],
  );

  const logLevelItems = LOG_LEVEL_OPTIONS.map((option, index) => {
    const className = logLevelToClass(option.key);
    return (
      <MenuItem key={index} value={option.key} className={className}>
        <Typography variant="body2">{option.text}</Typography>
      </MenuItem>
    );
  });

  const renderLogLevelValue = useCallback(
    (value: number) => {
      const option = LOG_LEVEL_OPTIONS.find((o) => o.key === value);
      const className = logLevelToClass(Number(option?.key ?? LogLevel.DEBUG));
      return <div className={className}>{option?.text}</div>;
    },
    [logLevelToClass],
  );

  return (
    <Stack className={classes.root} flex="auto" direction="row" gap={0.5} alignItems="center">
      <Select
        className={classes.levelSelect}
        value={props.minLogLevel}
        size="small"
        renderValue={renderLogLevelValue}
        onChange={(event) => {
          props.onFilterChange({
            minLogLevel: Number(event.target.value),
            searchTerms: Array.from(props.searchTerms),
          });
        }}
      >
        {logLevelItems}
      </Select>
      <FilterTagInput
        items={[...props.searchTerms]}
        suggestions={[...props.nodeNames]}
        onChange={(items: string[]) => {
          props.onFilterChange({
            minLogLevel: props.minLogLevel,
            searchTerms: items,
          });
        }}
      />
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
