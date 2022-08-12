// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CheckIcon from "@mui/icons-material/Check";
import CopyAllIcon from "@mui/icons-material/CopyAll";
import { Divider, IconButton, Typography } from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { useCallback, useMemo, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { areEqual, subtract as subtractTimes, toSec } from "@foxglove/rostime";
import Duration from "@foxglove/studio-base/components/Duration";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import { useMessagePipeline } from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import Timestamp from "@foxglove/studio-base/components/Timestamp";
import { Topic, TopicStats } from "@foxglove/studio-base/src/players/types";
import clipboard from "@foxglove/studio-base/util/clipboard";

import helpContent from "./index.help.md";

type TopicListItem = Topic & Partial<TopicStats> & { id: string };

const EMPTY_TOPICS: Topic[] = [];
const EMPTY_TOPIC_STATS = new Map<string, TopicStats>();

const useStyles = makeStyles<void, "copyIcon">()((theme, _params, classes) => ({
  header: {
    backgroundColor: theme.palette.background.paper,
  },
  tableRow: {
    [`&:hover .${classes.copyIcon}`]: {
      display: "block",
    },
  },
  copyIcon: {
    display: "none",

    "&:hover": {
      backgroundColor: "transparent",
    },
  },
}));

function CopyIconButton({ text }: { text: string }): JSX.Element {
  const { classes } = useStyles();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    clipboard
      .copy(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch((e) => console.warn(e));
  }, [text]);

  return (
    <Stack overflow="hidden" flex="auto" direction="row" alignItems="center" gap={1}>
      <Typography title={text} noWrap flex="auto" variant="inherit" style={{ minWidth: 0 }}>
        {text}
      </Typography>
      <IconButton
        className={classes.copyIcon}
        edge="end"
        size="small"
        onClick={handleCopy}
        title={copied ? "Copied" : "Copy to Clipboard"}
        aria-label={copied ? "Copied" : "Copy to Clipboard"}
        color={copied ? "success" : "primary"}
      >
        {copied ? <CheckIcon fontSize="small" /> : <CopyAllIcon fontSize="small" />}
      </IconButton>
    </Stack>
  );
}

function SourceInfo(): JSX.Element {
  const { classes } = useStyles();

  const topics = useMessagePipeline(
    useCallback((ctx) => ctx.playerState.activeData?.topics ?? EMPTY_TOPICS, []),
  );
  const topicStats = useMessagePipeline(
    useCallback((ctx) => ctx.playerState.activeData?.topicStats ?? EMPTY_TOPIC_STATS, []),
  );
  const startTime = useMessagePipeline(
    useCallback((ctx) => ctx.playerState.activeData?.startTime, []),
  );
  const endTime = useMessagePipeline(useCallback((ctx) => ctx.playerState.activeData?.endTime, []));

  const detailListItems = useMemo<TopicListItem[]>(() => {
    return topics.map((topic) => {
      const stats = topicStats.get(topic.name);
      return {
        ...topic,
        ...stats,
        id: topic.name,
      };
    });
  }, [topicStats, topics]);

  const columns: GridColDef<TopicListItem>[] = [
    {
      headerName: "Topic name",
      field: "name",
      flex: 3,
      renderCell: ({ row }) => <CopyIconButton text={row.name} />,
    },
    {
      headerName: "Datatype",
      field: "datatype",
      flex: 2,
      renderCell: ({ row }) => <CopyIconButton text={row.datatype} />,
    },
    {
      headerName: "Message count",
      field: "numMessages",
      width: 144,
      renderCell: ({ row }) => row.numMessages?.toLocaleString() ?? "–",
    },
    {
      headerName: "Frequency",
      field: "frequency",
      width: 144,
      renderCell: ({ row }) => {
        const { numMessages, firstMessageTime, lastMessageTime } = row;
        if (numMessages == undefined) {
          // No message count, so no frequency
          return "–";
        }
        if (firstMessageTime == undefined || lastMessageTime == undefined) {
          // Message count but no timestamps, use the full connection duration
          return `${(numMessages / toSec(duration)).toFixed(2)} Hz`;
        }
        if (numMessages < 2 || areEqual(firstMessageTime, lastMessageTime)) {
          // Not enough messages or time span to calculate a frequency
          return "–";
        }
        const topicDurationSec = toSec(subtractTimes(lastMessageTime, firstMessageTime));
        return `${((numMessages - 1) / topicDurationSec).toFixed(2)} Hz`;
      },
    },
  ];

  if (!startTime || !endTime) {
    return (
      <>
        <PanelToolbar helpContent={helpContent} />
        <EmptyState>Waiting for data...</EmptyState>
      </>
    );
  }

  const duration = subtractTimes(endTime, startTime);
  return (
    <>
      <PanelToolbar helpContent={helpContent} />
      <Divider />
      <Stack className={classes.header} padding={1.5} gap={1}>
        <Stack gap={0.5}>
          <Typography variant="overline" color="text.secondary">
            Start time
          </Typography>
          <Timestamp horizontal time={startTime} />
        </Stack>
        <Stack gap={0.5}>
          <Typography variant="overline" color="text.secondary">
            End Time
          </Typography>
          <Timestamp horizontal time={endTime} />
        </Stack>
        <Stack gap={0.5}>
          <Typography variant="overline" color="text.secondary">
            Duration
          </Typography>
          <Duration duration={duration} />
        </Stack>
      </Stack>
      <Divider />
      <DataGrid
        classes={{ row: classes.tableRow }}
        rows={detailListItems}
        columns={columns}
        disableSelectionOnClick
        density="compact"
        hideFooter
        disableColumnMenu
        localeText={{ noRowsLabel: "No Topics" }}
      />
    </>
  );
}

SourceInfo.panelType = "SourceInfo";
SourceInfo.defaultConfig = {};

export default Panel(SourceInfo);
