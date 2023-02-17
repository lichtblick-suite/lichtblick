// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Divider } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import CopyButton from "@foxglove/studio-base/components/CopyButton";
import { DataSourceInfoView } from "@foxglove/studio-base/components/DataSourceInfoView";
import { DirectTopicStatsUpdater } from "@foxglove/studio-base/components/DirectTopicStatsUpdater";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import { Topic } from "@foxglove/studio-base/src/players/types";

const useStyles = makeStyles<void, "copyIcon">()((theme, _params, classes) => ({
  copyIcon: {
    visibility: "hidden",

    "&:hover": {
      backgroundColor: "transparent",
    },
  },
  table: {
    borderCollapse: "collapse",
    display: "block",
    flex: 1,

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
      paddingBlock: theme.spacing(0.25),
      paddingInline: theme.spacing(1.5),
      whiteSpace: "nowrap",

      [`&:hover .${classes.copyIcon}`]: {
        visibility: "visible",
      },
    },
  },
}));

function TopicRow({ topic }: { topic: Topic }): JSX.Element {
  const { classes } = useStyles();

  return (
    <tr>
      <td>
        {topic.name}
        <CopyButton
          className={classes.copyIcon}
          edge="end"
          size="small"
          iconSize="small"
          getText={() => topic.name}
        />
      </td>
      <td>
        {topic.schemaName == undefined ? (
          "—"
        ) : (
          <>
            {topic.schemaName}
            <CopyButton
              className={classes.copyIcon}
              edge="end"
              size="small"
              iconSize="small"
              getText={() => topic.schemaName ?? ""}
            />
          </>
        )}
      </td>
      <td data-topic={topic.name} data-topic-stat="count">
        &mdash;
      </td>
      <td data-topic={topic.name} data-topic-stat="frequency">
        &mdash;
      </td>
    </tr>
  );
}

const selectSortedTopics = (ctx: MessagePipelineContext) => ctx.sortedTopics;
const selectStartTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.startTime;
const selectEndTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.endTime;

const MemoTopicRow = React.memo(TopicRow);

function SourceInfo(): JSX.Element {
  const { classes } = useStyles();

  const topics = useMessagePipeline(selectSortedTopics);
  const startTime = useMessagePipeline(selectStartTime);
  const endTime = useMessagePipeline(selectEndTime);

  if (!startTime || !endTime) {
    return (
      <>
        <PanelToolbar />
        <EmptyState>Waiting for data...</EmptyState>
      </>
    );
  }

  return (
    <>
      <PanelToolbar />
      <Divider />
      <Stack fullHeight overflowY="auto">
        <Stack padding={1.5}>
          <DataSourceInfoView />
        </Stack>
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
      </Stack>
    </>
  );
}

SourceInfo.panelType = "SourceInfo";
SourceInfo.defaultConfig = {};

export default Panel(SourceInfo);
