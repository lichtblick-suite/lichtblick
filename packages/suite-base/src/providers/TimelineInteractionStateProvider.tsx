// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { ReactNode, useState } from "react";
import { createStore, StoreApi } from "zustand";

import { TimelinePositionedEvent } from "@lichtblick/suite-base/context/EventsContext";
import {
  TimelineInteractionStateContext,
  TimelineInteractionStateStore,
  SyncBounds,
  SyncedDeltaMarkers,
} from "@lichtblick/suite-base/context/TimelineInteractionStateContext";
import { HoverValue } from "@lichtblick/suite-base/types/hoverValue";

function createTimelineInteractionStateStore(): StoreApi<TimelineInteractionStateStore> {
  return createStore((set) => {
    return {
      eventsAtHoverValue: {},
      globalBounds: undefined,
      globalDeltaMarkers: undefined,
      hoveredEvent: undefined,
      hoverValue: undefined,

      clearHoverValue: (componentId: string) => {
        set((store) => ({
          hoverValue: store.hoverValue?.componentId === componentId ? undefined : store.hoverValue,
        }));
      },

      setEventsAtHoverValue: (eventsAtHoverValue: TimelinePositionedEvent[]) => {
        set({ eventsAtHoverValue: _.keyBy(eventsAtHoverValue, (event) => event.event.id) });
      },

      setGlobalBounds: (
        newBounds:
          | undefined
          | SyncBounds
          | ((oldValue: undefined | SyncBounds) => undefined | SyncBounds),
      ) => {
        if (typeof newBounds === "function") {
          set((store) => ({ globalBounds: newBounds(store.globalBounds) }));
        } else {
          set({ globalBounds: newBounds });
        }
      },

      setGlobalDeltaMarkers: (
        newValue:
          | undefined
          | SyncedDeltaMarkers
          | ((oldValue: undefined | SyncedDeltaMarkers) => undefined | SyncedDeltaMarkers),
      ) => {
        if (typeof newValue === "function") {
          set((store) => ({ globalDeltaMarkers: newValue(store.globalDeltaMarkers) }));
        } else {
          set({ globalDeltaMarkers: newValue });
        }
      },

      setHoveredEvent: (hoveredEvent: undefined | TimelinePositionedEvent) => {
        if (hoveredEvent) {
          set({
            hoveredEvent,
            hoverValue: {
              componentId: `event_${hoveredEvent.event.id}`,
              type: "PLAYBACK_SECONDS",
              value: hoveredEvent.secondsSinceStart,
            },
          });
        } else {
          set({ hoveredEvent: undefined, hoverValue: undefined });
        }
      },

      setHoverValue: (newValue: HoverValue) => {
        set((store) => ({
          hoverValue: _.isEqual(newValue, store.hoverValue) ? store.hoverValue : newValue,
        }));
      },
    };
  });
}

export default function TimelineInteractionStateProvider({
  children,
}: {
  children?: ReactNode;
}): React.JSX.Element {
  const [store] = useState(createTimelineInteractionStateStore());

  return (
    <TimelineInteractionStateContext.Provider value={store}>
      {children}
    </TimelineInteractionStateContext.Provider>
  );
}
