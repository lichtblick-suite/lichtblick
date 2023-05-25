// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { createContext, useCallback } from "react";
import { StoreApi, useStore } from "zustand";

import { useGuaranteedContext } from "@foxglove/hooks";
import { Immutable } from "@foxglove/studio";
import { TimelinePositionedEvent } from "@foxglove/studio-base/context/EventsContext";
import type { HoverValue } from "@foxglove/studio-base/types/hoverValue";

/**
 * Represents the global bounds to which synced plots conform, including the id of the
 * component that set those bounds.
 */
export type SyncBounds = {
  min: number;
  max: number;
  sourceId: string;
  userInteraction: boolean;
};

/**
 * The TimelineInteractionStateStore manages state related to dynamic user interactions with data in the app.
 * Things like the hovered time value and global bounds for plots are managed here.
 */
export type TimelineInteractionStateStore = Immutable<{
  /** The events overlapping the current hover time, if any. */
  eventsAtHoverValue: Record<string, TimelinePositionedEvent>;

  /** Shared time bounds for synced plots, if any. */
  globalBounds: undefined | SyncBounds;

  /** The event directly hovered over by the user, if any. */
  hoveredEvent: undefined | TimelinePositionedEvent;

  /** The point in time hovered over by the user. */
  hoverValue: undefined | HoverValue;

  /** Clears the current hover value. */
  clearHoverValue: (componentId: string) => void;

  /** Sets the events overlapping the current hover time. */
  setEventsAtHoverValue: (events: TimelinePositionedEvent[]) => void;

  /** Sets new global bounds. */
  setGlobalBounds: (
    newBounds:
      | undefined
      | SyncBounds
      | ((oldValue: undefined | SyncBounds) => undefined | SyncBounds),
  ) => void;

  /** Sets or clears the directly hovered event. */
  setHoveredEvent: (hoveredEvent: undefined | TimelinePositionedEvent) => void;

  /** Sets the new hover value. */
  setHoverValue: (value: HoverValue) => void;
}>;

export const TimelineInteractionStateContext = createContext<
  undefined | StoreApi<TimelineInteractionStateStore>
>(undefined);
const selectClearHoverValue = (store: TimelineInteractionStateStore) => store.clearHoverValue;

export function useClearHoverValue(): TimelineInteractionStateStore["clearHoverValue"] {
  return useTimelineInteractionState(selectClearHoverValue);
}

const selectSetHoverValue = (store: TimelineInteractionStateStore) => {
  return store.setHoverValue;
};

export function useSetHoverValue(): TimelineInteractionStateStore["setHoverValue"] {
  return useTimelineInteractionState(selectSetHoverValue);
}

/**
 * Encapsulates logic for selecting the current hover value depending
 * on which component registered the hover value.
 */
export function useHoverValue(args?: {
  componentId: string;
  isTimestampScale: boolean;
}): HoverValue | undefined {
  const hasArgs = !!args;
  const componentId = args?.componentId;
  const isTimestampScale = args?.isTimestampScale ?? false;

  const selector = useCallback(
    (store: TimelineInteractionStateStore) => {
      if (!hasArgs) {
        // Raw form -- user needs to check that the value should be shown.
        return store.hoverValue;
      }
      if (store.hoverValue == undefined) {
        return undefined;
      }
      if (store.hoverValue.type === "PLAYBACK_SECONDS" && isTimestampScale) {
        // Always show playback-time hover values for timestamp-based charts.
        return store.hoverValue;
      }
      // Otherwise just show hover bars when hovering over the panel itself.
      return store.hoverValue.componentId === componentId ? store.hoverValue : undefined;
    },
    [hasArgs, componentId, isTimestampScale],
  );

  return useTimelineInteractionState(selector);
}

/**
 * This hook wraps all access to the interaction state store. Pass selectors
 * to access parts of the store.
 */
export function useTimelineInteractionState<T>(
  selector: (store: TimelineInteractionStateStore) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const context = useGuaranteedContext(TimelineInteractionStateContext);
  return useStore(context, selector, equalityFn);
}
