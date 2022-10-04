// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ClearIcon from "@mui/icons-material/Clear";
import SearchIcon from "@mui/icons-material/Search";
import { AppBar, CircularProgress, IconButton, TextField, Typography } from "@mui/material";
import { useCallback, useMemo } from "react";
import { makeStyles } from "tss-react/mui";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Stack from "@foxglove/studio-base/components/Stack";
import {
  EventsStore,
  TimelinePositionedEvent,
  useEvents,
} from "@foxglove/studio-base/context/EventsContext";
import {
  TimelineInteractionStateStore,
  useTimelineInteractionState,
} from "@foxglove/studio-base/context/TimelineInteractionStateContext";
import { useAppTimeFormat } from "@foxglove/studio-base/hooks";

import { EventView } from "./EventView";

const useStyles = makeStyles()((theme) => ({
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
    flexShrink: 1,
    gridTemplateColumns: "auto 1fr",
    overflowY: "auto",
    padding: theme.spacing(1),
  },
  root: {
    backgroundColor: theme.palette.background.paper,
    maxHeight: "100%",
  },
}));

const selectSeek = (ctx: MessagePipelineContext) => ctx.seekPlayback;
const selectEventFilter = (store: EventsStore) => store.filter;
const selectSetEventFilter = (store: EventsStore) => store.setFilter;
const selectEvents = (store: EventsStore) => store.events;
const selectHoveredEvent = (store: TimelineInteractionStateStore) => store.hoveredEvent;
const selectSetHoveredEvent = (store: TimelineInteractionStateStore) => store.setHoveredEvent;
const selectEventsAtHoverValue = (store: TimelineInteractionStateStore) => store.eventsAtHoverValue;
const selectSelectedEventId = (store: EventsStore) => store.selectedEventId;
const selectSelectEvent = (store: EventsStore) => store.selectEvent;

export function EventsList(): JSX.Element {
  const events = useEvents(selectEvents);
  const selectedEventId = useEvents(selectSelectedEventId);
  const selectEvent = useEvents(selectSelectEvent);
  const { formatTime } = useAppTimeFormat();
  const seek = useMessagePipeline(selectSeek);
  const eventsAtHoverValue = useTimelineInteractionState(selectEventsAtHoverValue);
  const hoveredEvent = useTimelineInteractionState(selectHoveredEvent);
  const setHoveredEvent = useTimelineInteractionState(selectSetHoveredEvent);
  const filter = useEvents(selectEventFilter);
  const setFilter = useEvents(selectSetEventFilter);

  const timestampedEvents = useMemo(
    () =>
      (events.value ?? []).map((event) => {
        return { ...event, formattedTime: formatTime(event.event.startTime) };
      }),
    [events, formatTime],
  );

  const clearFilter = useCallback(() => {
    setFilter("");
  }, [setFilter]);

  const onClick = useCallback(
    (event: TimelinePositionedEvent) => {
      if (event.event.id === selectedEventId) {
        selectEvent(undefined);
      } else {
        selectEvent(event.event.id);
      }

      if (seek) {
        seek(event.event.startTime);
      }
    },
    [seek, selectEvent, selectedEventId],
  );

  const onHoverEnd = useCallback(() => {
    setHoveredEvent(undefined);
  }, [setHoveredEvent]);

  const onHoverStart = useCallback(
    (event: TimelinePositionedEvent) => {
      setHoveredEvent(event);
    },
    [setHoveredEvent],
  );

  const { classes } = useStyles();

  return (
    <Stack className={classes.root} fullHeight>
      <AppBar className={classes.appBar} position="sticky" color="inherit" elevation={0}>
        <TextField
          variant="filled"
          fullWidth
          value={filter}
          onChange={(event) => setFilter(event.currentTarget.value)}
          placeholder="Search by key, value, or key:value"
          InputProps={{
            startAdornment: <SearchIcon fontSize="small" />,
            endAdornment: filter !== "" && (
              <IconButton edge="end" onClick={clearFilter} size="small">
                <ClearIcon fontSize="small" />
              </IconButton>
            ),
          }}
        />
      </AppBar>
      {events.loading && (
        <Stack flex="auto" padding={2} fullHeight alignItems="center" justifyContent="center">
          <CircularProgress />
        </Stack>
      )}
      {events.error && (
        <Stack flex="auto" padding={2} fullHeight alignItems="center" justifyContent="center">
          <Typography align="center" color="error">
            Error loading events.
          </Typography>
        </Stack>
      )}
      {events.value && events.value.length === 0 && (
        <Stack flex="auto" padding={2} fullHeight alignItems="center" justifyContent="center">
          <Typography align="center" color="text.secondary">
            No Events
          </Typography>
        </Stack>
      )}
      <div className={classes.grid}>
        {timestampedEvents.map((event) => {
          return (
            <EventView
              key={event.event.id}
              event={event}
              filter={filter}
              formattedTime={event.formattedTime}
              // When hovering within the event list only show hover state on directly
              // hovered event.
              isHovered={
                hoveredEvent
                  ? event.event.id === hoveredEvent.event.id
                  : eventsAtHoverValue[event.event.id] != undefined
              }
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
