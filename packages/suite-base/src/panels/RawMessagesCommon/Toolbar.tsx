// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import DiffIcon from "@mui/icons-material/Difference";
import DiffOutlinedIcon from "@mui/icons-material/DifferenceOutlined";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import { IconButton, MenuItem, Select, SelectChangeEvent } from "@mui/material";

import MessagePathInput from "@lichtblick/suite-base/components/MessagePathSyntax/MessagePathInput";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useStylesToolbar } from "@lichtblick/suite-base/panels/RawMessagesCommon/index.style";
import {
  PropsToolbar,
  RawMessagesVirtualPanelConfig,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/types";

import { PREV_MSG_METHOD, CUSTOM_METHOD } from "./constants";

function ToolbarComponent(props: PropsToolbar): React.JSX.Element {
  const {
    canExpandAll,
    diffEnabled,
    diffMethod,
    diffTopicPath,
    onDiffTopicPathChange,
    onToggleDiff,
    onToggleExpandAll,
    onTopicPathChange,
    saveConfig,
    topic,
    topicPath,
  } = props;

  const { classes, cx } = useStylesToolbar();

  return (
    <>
      <PanelToolbar className={classes.toolbar}>
        <IconButton
          className={cx(classes.iconButton, { "Mui-selected": diffEnabled })}
          title="Toggle diff"
          onClick={onToggleDiff}
          color={diffEnabled ? "default" : "inherit"}
          size="small"
        >
          {diffEnabled ? <DiffIcon fontSize="small" /> : <DiffOutlinedIcon fontSize="small" />}
        </IconButton>
        <IconButton
          className={classes.iconButton}
          title={canExpandAll ? "Expand all" : "Collapse all"}
          onClick={onToggleExpandAll}
          data-testid="expand-all"
          size="small"
        >
          {canExpandAll ? <UnfoldMoreIcon fontSize="small" /> : <UnfoldLessIcon fontSize="small" />}
        </IconButton>
        <Stack fullWidth paddingLeft={0.25}>
          <MessagePathInput
            index={0}
            path={topicPath}
            onChange={onTopicPathChange}
            inputStyle={{ height: 20 }}
          />
        </Stack>
      </PanelToolbar>
      {diffEnabled && (
        <div className={classes.diffOptions}>
          <Select
            variant="filled"
            size="small"
            title="Diff method"
            value={diffMethod}
            MenuProps={{ MenuListProps: { dense: true } }}
            onChange={(event: SelectChangeEvent) => {
              saveConfig({
                diffMethod: event.target.value as RawMessagesVirtualPanelConfig["diffMethod"],
              });
            }}
          >
            <MenuItem value={PREV_MSG_METHOD}>{PREV_MSG_METHOD}</MenuItem>
            <MenuItem value={CUSTOM_METHOD}>custom</MenuItem>
          </Select>
          {diffMethod === CUSTOM_METHOD && (
            <MessagePathInput
              index={1}
              path={diffTopicPath}
              onChange={onDiffTopicPathChange}
              {...(topic ? { prioritizedDatatype: topic.schemaName } : {})}
            />
          )}
        </div>
      )}
    </>
  );
}

export const Toolbar = React.memo(ToolbarComponent);
