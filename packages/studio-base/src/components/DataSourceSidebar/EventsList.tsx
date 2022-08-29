// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import SearchIcon from "@mui/icons-material/Search";
import { alpha, AppBar, CircularProgress, TextField, Typography } from "@mui/material";
import { compact } from "lodash";
import { Fragment, useCallback, useMemo, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { fromNanoSec, subtract, toSec } from "@foxglove/rostime";
import { HighlightedText } from "@foxglove/studio-base/components/HighlightedText";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Stack from "@foxglove/studio-base/components/Stack";
import { EventsStore, useEvents } from "@foxglove/studio-base/context/EventsContext";
import {
  useClearHoverValue,
  useSetHoverValue,
} from "@foxglove/studio-base/context/TimelineInteractionStateContext";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";
import { ConsoleEvent } from "@foxglove/studio-base/services/ConsoleApi";

const useStyles = makeStyles<void, "eventMetadata" | "eventSelected">()(
  (theme, _params, classes) => ({
    appBar: {
      top: -1,
      zIndex: theme.zIndex.appBar - 1,
      display: "flex",
      flexDirection: "row",
      padding: theme.spacing(1),
      gap: theme.spacing(1),
      alignItems: "center",
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
    grid: {
      display: "grid",
      flex: 1,
      gridTemplateColumns: "auto 1fr",
      overflowY: "auto",
      padding: theme.spacing(1),
    },
    root: {
      backgroundColor: theme.palette.background.paper,
      maxHeight: "100%",
    },
    spacer: {
      cursor: "default",
      height: theme.spacing(1),
      gridColumn: "span 2",
    },
    event: {
      display: "contents",
      cursor: "pointer",

      "&:hover, &:focus": {
        [`.${classes.eventMetadata}`]: {
          backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.focusOpacity),
          borderColor: theme.palette.primary.main,
        },
      },
    },
    eventSelected: {
      [`.${classes.eventMetadata}`]: {
        backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.activatedOpacity),
        borderColor: theme.palette.primary.main,
        boxShadow: `0 0 0 1px ${theme.palette.primary.main}`,
      },
    },
    eventMetadata: {
      padding: theme.spacing(1),
      backgroundColor: theme.palette.background.default,
      borderRight: `1px solid ${theme.palette.divider}`,
      borderBottom: `1px solid ${theme.palette.divider}`,

      "&:nth-of-type(odd)": {
        borderLeft: `1px solid ${theme.palette.divider}`,
      },
      "&:first-of-type": {
        borderTop: `1px solid ${theme.palette.divider}`,
        borderTopLeftRadius: theme.shape.borderRadius,
      },
      "&:nth-of-type(2)": {
        borderTop: `1px solid ${theme.palette.divider}`,
        borderTopRightRadius: theme.shape.borderRadius,
      },
      "&:nth-last-of-type(2)": {
        borderBottomRightRadius: theme.shape.borderRadius,
      },
      "&:nth-last-of-type(3)": {
        borderBottomLeftRadius: theme.shape.borderRadius,
      },
    },
  }),
);

function formatEventDuration(event: ConsoleEvent) {
  if (event.durationNanos === "0") {
    // instant
    return "-";
  }

  if (!event.durationNanos) {
    return "";
  }

  const intDuration = BigInt(event.durationNanos);

  if (intDuration >= BigInt(1e9)) {
    return `${Number(intDuration / BigInt(1e9))}s`;
  }

  if (intDuration >= BigInt(1e6)) {
    return `${Number(intDuration / BigInt(1e6))}ms`;
  }

  if (intDuration >= BigInt(1e3)) {
    return `${Number(intDuration / BigInt(1e3))}µs`;
  }

  return `${event.durationNanos}ns`;
}

const selectSeek = (ctx: MessagePipelineContext) => ctx.seekPlayback;
const selectStartTime = (ctx: MessagePipelineContext) => ctx.playerState.activeData?.startTime;

function EventView(params: {
  event: ConsoleEvent;
  filter: string;
  formattedTime: string;
  isSelected: boolean;
  onClick: (event: ConsoleEvent) => void;
  onHoverStart: (event: ConsoleEvent) => void;
  onHoverEnd: (event: ConsoleEvent) => void;
}): JSX.Element {
  const { event, filter, formattedTime, isSelected, onClick, onHoverStart, onHoverEnd } = params;
  const { classes, cx } = useStyles();

  const fields = compact([
    ["timestamp", formattedTime],
    Number(event.durationNanos) > 0 && ["duration", formatEventDuration(event)],
    ...Object.entries(event.metadata),
  ]);

  return (
    <div
      data-testid="sidebar-event"
      className={cx(classes.event, { [classes.eventSelected]: isSelected })}
      onClick={() => onClick(event)}
      onMouseEnter={() => onHoverStart(event)}
      onMouseLeave={() => onHoverEnd(event)}
    >
      {fields.map(([key, value]) => (
        <Fragment key={key}>
          <div className={classes.eventMetadata}>
            <HighlightedText text={key ?? ""} highlight={filter} />
          </div>
          <div className={classes.eventMetadata}>
            <HighlightedText text={value ?? ""} highlight={filter} />
          </div>
        </Fragment>
      ))}
      <div className={classes.spacer} />
    </div>
  );
}

const MemoEventView = React.memo(EventView);

const selectEvents = (store: EventsStore) => store.events;
const selectSelectedEventId = (store: EventsStore) => store.selectedEventId;
const selectSelectEvent = (store: EventsStore) => store.selectEvent;

export function EventsList(): JSX.Element {
  const events = useEvents(selectEvents);
  const selectedEventId = useEvents(selectSelectedEventId);
  const selectEvent = useEvents(selectSelectEvent);
  const { formatTime } = useAppTimeFormat();
  const startTime = useMessagePipeline(selectStartTime);
  const setHoverValue = useSetHoverValue();
  const clearHoverValue = useClearHoverValue();
  const [filter, setFilter] = useState("");
  const seek = useMessagePipeline(selectSeek);

  const filteredEvents = useMemo(() => {
    if (filter.length === 0) {
      return events.value ?? [];
    }
    const lowFilter = filter.toLowerCase();

    return (events.value ?? []).filter((event) =>
      Object.entries(event.metadata).some(
        ([key, value]) =>
          key.toLowerCase().includes(lowFilter) || value.toLowerCase().includes(lowFilter),
      ),
    );
  }, [events.value, filter]);

  const timestampedEvents = useMemo(
    () =>
      filteredEvents.map((event) => {
        const time = fromNanoSec(BigInt(event.timestampNanos));

        return { event, formattedTime: formatTime(time) };
      }),
    [filteredEvents, formatTime],
  );

  const onClick = useCallback(
    (event: ConsoleEvent) => {
      selectEvent(event.id);
      if (seek) {
        const time = fromNanoSec(BigInt(event.timestampNanos));
        seek(time);
      }
    },
    [seek, selectEvent],
  );

  const onHoverEnd = useCallback(
    (event: ConsoleEvent) => {
      clearHoverValue(`event_${event.id}`);
    },
    [clearHoverValue],
  );

  const onHoverStart = useCallback(
    (event: ConsoleEvent) => {
      const time = fromNanoSec(BigInt(event.timestampNanos));
      const delta = startTime ? subtract(time, startTime) : undefined;
      const deltaTime = delta ? toSec(delta) : undefined;
      const hoverId = `event_${event.id}`;

      if (deltaTime == undefined) {
        return;
      }

      setHoverValue({
        componentId: hoverId,
        type: "PLAYBACK_SECONDS",
        value: deltaTime,
      });
    },
    [setHoverValue, startTime],
  );

  const { classes } = useStyles();

  if (events.loading) {
    return (
      <Stack flex="auto" padding={2} fullHeight alignItems="center" justifyContent="center">
        <CircularProgress />
      </Stack>
    );
  }

  if (events.error) {
    return (
      <Stack flex="auto" padding={2} fullHeight alignItems="center" justifyContent="center">
        <Typography align="center" color="error">
          Error loading events.
        </Typography>
      </Stack>
    );
  }

  if ((events.value ?? []).length === 0) {
    return (
      <Stack flex="auto" padding={2} fullHeight alignItems="center" justifyContent="center">
        <Typography align="center" color="text.secondary">
          No Events
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack className={classes.root}>
      <AppBar className={classes.appBar} position="sticky" color="inherit" elevation={0}>
        <TextField
          variant="filled"
          fullWidth
          value={filter}
          onChange={(event) => setFilter(event.currentTarget.value)}
          placeholder="Filter event metadata"
          InputProps={{
            startAdornment: <SearchIcon fontSize="small" />,
          }}
        />
      </AppBar>
      <div className={classes.grid}>
        {timestampedEvents.map((event) => {
          return (
            <MemoEventView
              key={event.event.id}
              event={event.event}
              filter={filter}
              formattedTime={event.formattedTime}
              isSelected={event.event.id === selectedEventId}
              onClick={onClick}
              onHoverStart={onHoverStart}
              onHoverEnd={onHoverEnd}
            />
          );
        })}
      </div>
    </Stack>
  );
}
