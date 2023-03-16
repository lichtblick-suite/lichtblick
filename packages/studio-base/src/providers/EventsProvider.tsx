// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReactNode, useState } from "react";
import { AsyncState } from "react-use/lib/useAsyncFn";
import { createStore } from "zustand";

import {
  EventsContext,
  EventsStore,
  TimelinePositionedEvent,
} from "@foxglove/studio-base/context/EventsContext";

const NO_EVENTS: TimelinePositionedEvent[] = [];

function createEventsStore() {
  return createStore<EventsStore>((set) => ({
    eventFetchCount: 0,
    events: { loading: false, value: NO_EVENTS },
    filter: "",
    selectedEventId: undefined,
    eventsSupported: false,
    deviceId: undefined,

    refreshEvents: () => set((old) => ({ eventFetchCount: old.eventFetchCount + 1 })),
    selectEvent: (id: undefined | string) => set({ selectedEventId: id }),
    setEvents: (events: AsyncState<TimelinePositionedEvent[]>) =>
      set({ events, selectedEventId: undefined }),
    setFilter: (filter: string) => set({ filter }),
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    setEventsSupported: (eventsSupported: boolean) => set({ eventsSupported }),
    setDeviceId: (deviceId: string | undefined) => set({ deviceId }),
  }));
}

export default function EventsProvider({ children }: { children?: ReactNode }): JSX.Element {
  const [store] = useState(createEventsStore);

  return <EventsContext.Provider value={store}>{children}</EventsContext.Provider>;
}
