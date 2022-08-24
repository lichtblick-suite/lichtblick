// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Box, Divider } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import { DataSourceInfoView } from "@foxglove/studio-base/components/DataSourceInfoView";
import { DirectTopicStatsUpdater } from "@foxglove/studio-base/components/DirectTopicStatsUpdater";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import { Topic } from "@foxglove/studio-base/src/players/types";

import helpContent from "./index.help.md";

const EMPTY_TOPICS: Topic[] = [];

const useStyles = makeStyles()((theme) => ({
  table: {
    borderCollapse: "collapse",
    display: "block",
    flex: 1,
    overflowY: "auto",

    thead: {
      position: "sticky",
      textAlign: "left",
      top: 0,
    },

    tr: {
      "&:hover": {
        backgroundColor: theme.palette.background.paper,
      },
    },

    th: {
      backgroundColor: theme.palette.background.paper,
      paddingBlock: theme.spacing(1),
      paddingInline: theme.spacing(1.5),
      whiteSpace: "nowrap",
      width: "100%",
    },

    td: {
      paddingBlock: theme.spacing(1),
      paddingInline: theme.spacing(1.5),
      whiteSpace: "nowrap",
    },
  },
}));

function TopicRow({ topic }: { topic: Topic }): JSX.Element {
  return (
    <tr>
      <td>{topic.name}</td>
      <td>{topic.datatype}</td>
      <td data-topic={topic.name} data-topic-stat="count">
        &mdash;
      </td>
      <td data-topic={topic.name} data-topic-stat="frequency">
        &mdash;
      </td>
    </tr>
  );
}

const selectTopics = (ctx: MessagePipelineContext) =>
  ctx.playerState.activeData?.topics ?? EMPTY_TOPICS;
const selectStartTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.startTime;
const selectEndTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.endTime;

const MemoTopicRow = React.memo(TopicRow);

function SourceInfo(): JSX.Element {
  const { classes } = useStyles();

  const topics = useMessagePipeline(selectTopics);
  const startTime = useMessagePipeline(selectStartTime);
  const endTime = useMessagePipeline(selectEndTime);

  if (!startTime || !endTime) {
    return (
      <>
        <PanelToolbar helpContent={helpContent} />
        <EmptyState>Waiting for data...</EmptyState>
      </>
    );
  }

  return (
    <>
      <PanelToolbar helpContent={helpContent} />
      <Divider />
      <Box paddingTop={1}>
        <DataSourceInfoView />
      </Box>
      <Divider />
      <table className={classes.table}>
        <thead>
          <tr>
            <th>Topic Name</th>
            <th>Datatype</th>
            <th>Message count</th>
            <th>Frequency</th>
          </tr>
        </thead>
        <tbody>
          {topics.map((topic) => (
            <MemoTopicRow key={topic.name} topic={topic} />
          ))}
        </tbody>
      </table>
      <DirectTopicStatsUpdater interval={6} />
    </>
  );
}

SourceInfo.panelType = "SourceInfo";
SourceInfo.defaultConfig = {};

export default Panel(SourceInfo);
