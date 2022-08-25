// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";
import { AsyncState } from "react-use/lib/useAsyncFn";
import { StoreApi, useStore } from "zustand";

import useGuaranteedContext from "@foxglove/studio-base/hooks/useGuaranteedContext";
import { ConsoleEvent } from "@foxglove/studio-base/services/ConsoleApi";

export type EventsStore = {
  events: AsyncState<ConsoleEvent[]>;
  selectedEventId: undefined | string;
  selectEvent: (id: undefined | string) => void;
  setEvents: (events: AsyncState<ConsoleEvent[]>) => void;
};

export const EventsContext = createContext<undefined | StoreApi<EventsStore>>(undefined);

export function useEvents<T>(
  selector: (store: EventsStore) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const context = useGuaranteedContext(EventsContext);
  return useStore(context, selector, equalityFn);
}
