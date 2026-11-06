// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { Button, InputAdornment, Menu, MenuItem, Tooltip } from "@mui/material";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";

import { Channel } from "@lichtblick/suite";
import { channelLabel } from "@lichtblick/suite-base/components/MessagePathSyntax/channelLabel";
import { useChannels } from "@lichtblick/suite-base/hooks/useChannels";

const useStyles = makeStyles()((theme) => ({
  badge: {
    minWidth: 0,
    maxWidth: theme.spacing(20),
    padding: theme.spacing(0, 0.5),
    fontSize: theme.typography.caption.fontSize,
    textTransform: "none",
    whiteSpace: "nowrap",
  },
  label: { overflow: "hidden", textOverflow: "ellipsis" },
}));

/** Compact channel switcher embedded in the message-path input. */
export function ChannelPicker({
  topic,
  channelId,
  onChange,
  label = "Channel",
}: {
  topic?: string;
  channelId?: string;
  onChange: (channel: Channel) => void;
  label?: string;
}): React.JSX.Element | undefined {
  const channels = useChannels().filter((channel) => channel.topic === topic);
  const value = channels.find((channel) => channel.id === channelId);
  const [anchor, setAnchor] = useState<HTMLElement>();
  const { classes } = useStyles();
  if (topic == undefined || (channels.length === 0 && channelId == undefined)) {
    return undefined;
  }
  const description =
    value == undefined
      ? channelId == undefined
        ? "Choose channel"
        : `Unavailable: ${channelId}`
      : channelLabel(value);
  const badgeLabel =
    value == undefined
      ? description
      : `${value.schemaName.split(/[/.]/).at(-1)} · ${value.source.kind === "native" ? "Native" : "Converted"}`;
  return (
    <InputAdornment position="start">
      <Tooltip title={description}>
        <Button
          className={classes.badge}
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={anchor != undefined}
          color={value == undefined ? "warning" : "inherit"}
          onMouseDown={(event) => { event.stopPropagation(); }}
          onClick={(event) => {
            event.stopPropagation();
            setAnchor(event.currentTarget);
          }}
          endIcon={<ArrowDropDownIcon fontSize="small" />}
        >
          <span className={classes.label}>{badgeLabel}</span>
        </Button>
      </Tooltip>
      <Menu
        onClick={(event) => { event.stopPropagation(); }}
        anchorEl={anchor}
        open={anchor != undefined}
        onClose={() => {
          setAnchor(undefined);
        }}
      >
        {channels.map((channel) => (
          <MenuItem
            key={channel.id}
            selected={channel.id === channelId}
            onClick={() => {
              onChange(channel);
              setAnchor(undefined);
            }}
          >
            {channelLabel(channel)}
          </MenuItem>
        ))}
        {channels.length === 0 && <MenuItem disabled>Channel unavailable</MenuItem>}
      </Menu>
    </InputAdornment>
  );
}
