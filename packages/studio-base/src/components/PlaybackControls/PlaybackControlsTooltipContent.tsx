// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Divider, Typography } from "@mui/material";
import * as _ from "lodash-es";
import { Fragment } from "react";
import { makeStyles } from "tss-react/mui";

import { subtract as subtractTimes, toSec, Time } from "@foxglove/rostime";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import {
  TimelineInteractionStateStore,
  useTimelineInteractionState,
} from "@foxglove/studio-base/context/TimelineInteractionStateContext";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";

type PlaybackControlsTooltipItem =
  | { type: "divider" }
  | { type: "item"; title: string; value: string };

const useStyles = makeStyles()((theme) => ({
  tooltipDivider: {
    gridColumn: "span 2",
    marginBlock: theme.spacing(0.5),
    opacity: 0.5,
  },
  tooltipWrapper: {
    fontFeatureSettings: `${theme.typography.fontFeatureSettings}, "zero"`,
    fontFamily: theme.typography.body1.fontFamily,
    whiteSpace: "nowrap",
    columnGap: theme.spacing(0.5),
    display: "grid",
    alignItems: "center",
    gridTemplateColumns: "auto auto",
    width: "100%",
    flexDirection: "column",
  },
  itemKey: {
    fontSize: "0.7rem",
    opacity: 0.7,
    textAlign: "end",
    textTransform: "lowercase",
  },
}));

const selectHoveredEvents = (store: TimelineInteractionStateStore) => store.eventsAtHoverValue;
const selectStartTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.startTime;

export function PlaybackControlsTooltipContent(params: { stamp: Time }): ReactNull | JSX.Element {
  const { stamp } = params;
  const { timeFormat, formatTime, formatDate } = useAppTimeFormat();
  const hoveredEvents = useTimelineInteractionState(selectHoveredEvents);
  const startTime = useMessagePipeline(selectStartTime);
  const { classes } = useStyles();

  if (!startTime) {
    return ReactNull;
  }

  const timeFromStart = subtractTimes(stamp, startTime);

  const tooltipItems: PlaybackControlsTooltipItem[] = [];

  if (!_.isEmpty(hoveredEvents)) {
    Object.values(hoveredEvents).forEach(({ event }) => {
      tooltipItems.push({
        type: "item",
        title: "Start",
        value: formatTime(event.startTime),
      });
      tooltipItems.push({
        type: "item",
        title: "End",
        value: formatTime(event.endTime),
      });
      if (!_.isEmpty(event.metadata)) {
        Object.entries(event.metadata).forEach(([metaKey, metaValue]) => {
          tooltipItems.push({ type: "item", title: metaKey, value: metaValue });
        });
      }
      tooltipItems.push({ type: "divider" });
    });
  }

  switch (timeFormat) {
    case "TOD":
      tooltipItems.push({ type: "item", title: "Date", value: formatDate(stamp) });
      tooltipItems.push({ type: "item", title: "Time", value: formatTime(stamp) });
      break;
    case "SEC":
      tooltipItems.push({ type: "item", title: "SEC", value: formatTime(stamp) });
      break;
  }

  tooltipItems.push({
    type: "item",
    title: "Elapsed",
    value: `${toSec(timeFromStart).toFixed(9)} sec`,
  });

  return (
    <div className={classes.tooltipWrapper}>
      {tooltipItems.map((item, idx) => {
        if (item.type === "divider") {
          return <Divider key={`divider_${idx}`} className={classes.tooltipDivider} />;
        }
        return (
          <Fragment key={`${item.title}_${idx}`}>
            <Typography className={classes.itemKey} noWrap>
              {item.title}
            </Typography>
            <Typography variant="subtitle2" noWrap>
              {item.value}
            </Typography>
          </Fragment>
        );
      })}
    </div>
  );
}
