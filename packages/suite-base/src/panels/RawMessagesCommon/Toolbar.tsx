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

import { parseMessagePath } from "@lichtblick/message-path";
import MessagePathInput from "@lichtblick/suite-base/components/MessagePathSyntax/MessagePathInput";
import PanelToolbar from "@lichtblick/suite-base/components/PanelToolbar";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useChannels } from "@lichtblick/suite-base/hooks/useChannels";
import { useStylesToolbar } from "@lichtblick/suite-base/panels/RawMessagesCommon/index.style";
import {
  PropsToolbar,
  RawMessagesVirtualPanelConfig,
} from "@lichtblick/suite-base/panels/RawMessagesCommon/types";

import { ChannelPicker } from "./ChannelPicker";
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
    channelId,
    diffChannelId,
  } = props;

  const { classes, cx } = useStylesToolbar();
  const channels = useChannels();
  const comparisonSchemaName = channels.find(
    (channel) =>
      channel.id === diffChannelId && channel.topic === parseMessagePath(diffTopicPath)?.topicName,
  )?.schemaName;

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
            schemaName={topic?.schemaName}
            onChange={onTopicPathChange}
            channelSelection={{
              channels,
              channelId,
              onChange: (path, id) => {
                onTopicPathChange(path);
                saveConfig({ topicPath: path, channelId: id });
              },
            }}
            startAdornment={
              <ChannelPicker
                topic={parseMessagePath(topicPath)?.topicName}
                channelId={channelId}
                onChange={(channel) => {
                  saveConfig({ channelId: channel.id });
                }}
              />
            }
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
              schemaName={comparisonSchemaName}
              onChange={onDiffTopicPathChange}
              channelSelection={{
                channels,
                channelId: diffChannelId,
                onChange: (path, id) => {
                  saveConfig({ diffTopicPath: path, diffChannelId: id });
                },
              }}
              startAdornment={
                <ChannelPicker
                  label="Comparison channel"
                  topic={parseMessagePath(diffTopicPath)?.topicName}
                  channelId={diffChannelId}
                  onChange={(channel) => {
                    saveConfig({ diffChannelId: channel.id });
                  }}
                />
              }
              {...(topic ? { prioritizedDatatype: topic.schemaName } : {})}
            />
          )}
        </div>
      )}
    </>
  );
}

export const Toolbar = React.memo(ToolbarComponent);
