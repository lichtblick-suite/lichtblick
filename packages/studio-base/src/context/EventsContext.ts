// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";
import { AsyncState } from "react-use/lib/useAsyncFn";
import { StoreApi, useStore } from "zustand";

import { Time } from "@foxglove/rostime";
import { Immutable } from "@foxglove/studio";
import useGuaranteedContext from "@foxglove/studio-base/hooks/useGuaranteedContext";

/**
 * DataSourceEvent representings a single event within a data source.
 */
export type DataSourceEvent = {
  id: string;
  createdAt: string;
  deviceId: string;
  durationNanos: string;
  endTime: Time;
  endTimeInSeconds: number;
  metadata: Record<string, string>;
  startTime: Time;
  startTimeInSeconds: number;
  timestampNanos: string;
  updatedAt: string;
};

/**
 * Represents an event including its fractional position on the timeline.
 */
export type TimelinePositionedEvent = {
  /** The event. */
  event: DataSourceEvent;

  /** The end position of the event, as a value 0-1 relative to the timeline. */
  endPosition: number;

  /** The start position of the event, as a value 0-1 relative to the timeline. */
  startPosition: number;

  /** The time, in seconds, relative to the start of the timeline. */
  secondsSinceStart: number;
};

export type EventsStore = Immutable<{
  /** Used to signal event refreshes. */
  eventFetchCount: number;

  /** Whether events are supported for the currently loaded source. */
  eventsSupported: boolean;

  /** Fetched events for this session. */
  events: AsyncState<TimelinePositionedEvent[]>;

  /** The current event filter expression. */
  filter: string;

  /** The currently selected event, if any. */
  selectedEventId: undefined | string;

  /** The active device under which new events should be created. */
  deviceId: string | undefined;

  /** Refreshes events from api. */
  refreshEvents: () => void;

  /** Select an event by id or clear the selection. */
  selectEvent: (id: undefined | string) => void;

  /** Set the fetched events. */
  setEvents: (events: AsyncState<TimelinePositionedEvent[]>) => void;

  /** Set the flag indicating support for events. */
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setEventsSupported: (supported: boolean) => void;

  /** Update the current filter expression. */
  setFilter: (filter: string) => void;

  /** Set the active device. */
  setDeviceId: (deviceId: string | undefined) => void;
}>;

export const EventsContext = createContext<undefined | StoreApi<EventsStore>>(undefined);

export function useEvents<T>(
  selector: (store: EventsStore) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const context = useGuaranteedContext(EventsContext);
  return useStore(context, selector, equalityFn);
}
