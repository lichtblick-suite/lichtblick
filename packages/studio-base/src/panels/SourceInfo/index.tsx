// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  ITextStyles,
  DetailsList,
  makeStyles,
  Stack,
  Text,
  useTheme,
  CheckboxVisibility,
} from "@fluentui/react";
import { useCallback, useMemo } from "react";

import { subtract as subtractTimes, toSec } from "@foxglove/rostime";
import { Topic } from "@foxglove/studio";
import CopyText from "@foxglove/studio-base/components/CopyText";
import Duration from "@foxglove/studio-base/components/Duration";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import { useMessagePipeline } from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Timestamp from "@foxglove/studio-base/components/Timestamp";

import helpContent from "./index.help.md";

const useStyles = makeStyles(() => ({
  container: {
    overflowX: "hidden",
    overflowY: "auto",
  },
}));

function SourceInfo() {
  const topics = useMessagePipeline(useCallback((ctx) => ctx.playerState.activeData?.topics, []));
  const startTime = useMessagePipeline(
    useCallback((ctx) => ctx.playerState.activeData?.startTime, []),
  );
  const endTime = useMessagePipeline(useCallback((ctx) => ctx.playerState.activeData?.endTime, []));
  const classes = useStyles();
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

  const detailListItems = useMemo<(Topic & { key: string })[]>(() => {
    return (
      topics?.map((topic) => ({
        key: topic.name,
        ...topic,
      })) ?? []
    );
  }, [topics]);

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
      <div className={classes.container}>
        <Stack
          styles={{
            root: {
              borderBottom: `2px solid ${theme.semanticColors.bodyDivider}`,
              backgroundColor: theme.semanticColors.bodyBackground,
            },
          }}
          tokens={{ padding: 12, childrenGap: theme.spacing.s1 }}
        >
          <Stack tokens={{ childrenGap: theme.spacing.s2 }}>
            <Text styles={subheaderStyles}>Start time</Text>
            <Timestamp horizontal time={startTime} />
          </Stack>
          <Stack tokens={{ childrenGap: theme.spacing.s2 }}>
            <Text styles={subheaderStyles}>End Time</Text>
            <Timestamp horizontal time={endTime} />
          </Stack>
          <Stack tokens={{ childrenGap: theme.spacing.s2 }}>
            <Text styles={subheaderStyles}>Duration</Text>
            <Duration duration={duration} />
          </Stack>
        </Stack>
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
              name: "topic name",
              fieldName: "name",
              minWidth: 200,
              isResizable: true,
              data: "string",
              isPadded: true,
              onRender: (topic) => (
                <CopyText
                  copyText={topic.name}
                  textProps={{ variant: "small" }}
                  tooltip={`Click to copy topic name ${topic.name} to clipboard.`}
                >
                  {topic.name}
                </CopyText>
              ),
            },
            {
              key: "datatype",
              name: "datatype",
              fieldName: "datatype",
              minWidth: 200,
              isResizable: true,
              data: "string",
              isPadded: true,
              onRender: (topic) => (
                <CopyText
                  copyText={topic.datatype}
                  textProps={{ variant: "small" }}
                  tooltip={`Click to copy topic name ${topic.datatype} to clipboard.`}
                >
                  {topic.datatype}
                </CopyText>
              ),
            },
            {
              key: "numMessages",
              name: "message count",
              fieldName: "numMessages",
              minWidth: 0,
              data: "number",
              isPadded: true,
            },
            {
              key: "frequency",
              name: "frequency",
              minWidth: 0,
              onRender: (topic) =>
                topic.numMessages != undefined
                  ? `${(topic.numMessages / toSec(duration)).toFixed(2)} Hz`
                  : "",
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
