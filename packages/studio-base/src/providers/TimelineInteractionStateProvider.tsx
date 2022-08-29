// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEqual } from "lodash";
import { ReactNode, useState } from "react";
import { createStore, StoreApi } from "zustand";

import {
  TimelineInteractionStateContext,
  TimelineInteractionStateStore,
  SyncBounds,
} from "@foxglove/studio-base/context/TimelineInteractionStateContext";
import { HoverValue } from "@foxglove/studio-base/types/hoverValue";

function createTimelineInteractionStateStore(): StoreApi<TimelineInteractionStateStore> {
  return createStore((set, get) => {
    return {
      /** Shared time bounds for synced plots, if any. */
      globalBounds: undefined,

      /** The point in time hovered over by the user. */
      hoverValue: undefined,

      /** Clears the current hover value. */
      clearHoverValue: (componentId: string) =>
        set((store) => ({
          hoverValue: store.hoverValue?.componentId === componentId ? undefined : store.hoverValue,
        })),

      /**
       * Sets new global bounds.
       */
      setGlobalBounds: (
        newBounds:
          | undefined
          | SyncBounds
          | ((oldValue: undefined | SyncBounds) => undefined | SyncBounds),
      ) => {
        if (typeof newBounds === "function") {
          set({ globalBounds: newBounds(get().globalBounds) });
        } else {
          set({ globalBounds: newBounds });
        }
      },

      /**
       * Sets the new hover value.
       */
      setHoverValue: (newValue: HoverValue) =>
        set((store) => ({
          hoverValue: isEqual(newValue, store.hoverValue) ? store.hoverValue : newValue,
        })),
    };
  });
}

export default function TimelineInteractionStateProvider({
  children,
}: {
  children?: ReactNode;
}): JSX.Element {
  const [store] = useState(createTimelineInteractionStateStore());

  return (
    <TimelineInteractionStateContext.Provider value={store}>
      {children}
    </TimelineInteractionStateContext.Provider>
  );
}
