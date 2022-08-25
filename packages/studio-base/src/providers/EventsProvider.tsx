// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReactNode, useState } from "react";
import { AsyncState } from "react-use/lib/useAsyncFn";
import { createStore } from "zustand";

import { EventsContext, EventsStore } from "@foxglove/studio-base/context/EventsContext";
import { ConsoleEvent } from "@foxglove/studio-base/services/ConsoleApi";

export default function EventsProvider({ children }: { children?: ReactNode }): JSX.Element {
  const [store] = useState(
    createStore<EventsStore>((set) => ({
      events: { loading: false, value: [] },
      selectedEventId: undefined,
      selectEvent: (id: undefined | string) => set({ selectedEventId: id }),
      setEvents: (events: AsyncState<ConsoleEvent[]>) => set({ events }),
    })),
  );

  return <EventsContext.Provider value={store}>{children}</EventsContext.Provider>;
}
