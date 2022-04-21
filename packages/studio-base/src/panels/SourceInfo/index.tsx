// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ITextStyles, DetailsList, Text, useTheme, CheckboxVisibility } from "@fluentui/react";
import { Theme } from "@mui/material";
import { makeStyles } from "@mui/styles";
import { useCallback, useMemo } from "react";

import { areEqual, subtract as subtractTimes, toSec } from "@foxglove/rostime";
import CopyText from "@foxglove/studio-base/components/CopyText";
import Duration from "@foxglove/studio-base/components/Duration";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import { useMessagePipeline } from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Timestamp from "@foxglove/studio-base/components/Timestamp";
import { Topic, TopicStats } from "@foxglove/studio-base/src/players/types";

import helpContent from "./index.help.md";

type TopicListItem = Topic & Partial<TopicStats> & { key: string };

const useStyles = makeStyles((theme: Theme) => ({
  root: {
    overflow: "hidden auto",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    borderBottom: `2px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.default,
    padding: theme.spacing(1.5),
    gap: theme.spacing(1),
  },
  row: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.5),
  },
}));

const EMPTY_TOPICS: Topic[] = [];
const EMPTY_TOPIC_STATS = new Map<string, TopicStats>();

function SourceInfo() {
  const classes = useStyles();
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
  const theme = useTheme();
  const subheaderStyles = useMemo(
    () =>
      ({
        root: {
          fontVariant: "small-caps",
          textTransform: "lowercase",
          color: theme.palette.neutralSecondaryAlt,
          letterSpacing: "0.5px",
        },
      } as ITextStyles),
    [theme],
  );

  const detailListItems = useMemo<TopicListItem[]>(() => {
    return topics.map((topic) => {
      const stats = topicStats.get(topic.name);
      return {
        ...topic,
        ...stats,
        key: topic.name,
      };
    });
  }, [topicStats, topics]);

  if (!startTime || !endTime) {
    return (
      <>
        <PanelToolbar helpContent={helpContent} floating />
        <EmptyState>Waiting for data...</EmptyState>
      </>
    );
  }

  const duration = subtractTimes(endTime, startTime);
  return (
    <>
      <PanelToolbar helpContent={helpContent} floating />
      <div className={classes.root}>
        <header className={classes.header}>
          <div className={classes.row}>
            <Text styles={subheaderStyles}>Start time</Text>
            <Timestamp horizontal time={startTime} />
          </div>
          <div className={classes.row}>
            <Text styles={subheaderStyles}>End Time</Text>
            <Timestamp horizontal time={endTime} />
          </div>
          <div className={classes.row}>
            <Text styles={subheaderStyles}>Duration</Text>
            <Duration duration={duration} />
          </div>
        </header>

        <DetailsList
          compact
          checkboxVisibility={CheckboxVisibility.hidden}
          disableSelectionZone
          enableUpdateAnimations={false}
          items={detailListItems}
          styles={{
            root: {
              ".ms-DetailsHeader": { paddingTop: 0, height: 32, lineHeight: 32 },
              ".ms-DetailsHeader-cell": { height: 32 },
              ".ms-DetailsHeader-cellName": { ...theme.fonts.smallPlus, fontWeight: "bold" },
            },
          }}
          columns={[
            {
              key: "name",
              name: "Topic name",
              fieldName: "name",
              minWidth: 0,
              isResizable: true,
              data: "string",
              isPadded: true,
              onRender: (item: TopicListItem) => (
                <CopyText
                  copyText={item.name}
                  textProps={{ variant: "small" }}
                  tooltip={`Click to copy topic name ${item.name} to clipboard.`}
                >
                  {item.name}
                </CopyText>
              ),
            },
            {
              key: "datatype",
              name: "Datatype",
              fieldName: "datatype",
              minWidth: 0,
              isResizable: true,
              data: "string",
              isPadded: true,
              onRender: (item: TopicListItem) => (
                <CopyText
                  copyText={item.datatype}
                  textProps={{ variant: "small" }}
                  tooltip={`Click to copy topic name ${item.datatype} to clipboard.`}
                >
                  {item.datatype}
                </CopyText>
              ),
            },
            {
              key: "numMessages",
              name: "Message count",
              fieldName: "numMessages",
              minWidth: 0,
              onRender: (item: TopicListItem) => item.numMessages?.toLocaleString() ?? "–",
            },
            {
              key: "frequency",
              name: "Frequency",
              minWidth: 0,
              onRender: (item: TopicListItem) => {
                const { numMessages, firstMessageTime, lastMessageTime } = item;
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
          ]}
        />
      </div>
    </>
  );
}

SourceInfo.panelType = "SourceInfo";
SourceInfo.defaultConfig = {};

export default Panel(SourceInfo);
