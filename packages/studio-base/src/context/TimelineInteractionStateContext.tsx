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
import { DeepReadonly } from "ts-essentials";
import { StoreApi, useStore } from "zustand";

import useGuaranteedContext from "@foxglove/studio-base/hooks/useGuaranteedContext";
import type { HoverValue } from "@foxglove/studio-base/types/hoverValue";

export type SyncBounds = { min: number; max: number; sourceId: string; userInteraction: boolean };

/**
 * The TimelineInteractionStateStore manages state related to dynamic user interactions with data in the app.
 * Things like the hovered time value and global bounds for plots are managed here.
 */
export type TimelineInteractionStateStore = DeepReadonly<{
  globalBounds: undefined | SyncBounds;
  hoverValue: undefined | HoverValue;

  clearHoverValue: (componentId: string) => void;
  setGlobalBounds: (
    newBounds:
      | undefined
      | SyncBounds
      | ((oldValue: undefined | SyncBounds) => undefined | SyncBounds),
  ) => void;
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
