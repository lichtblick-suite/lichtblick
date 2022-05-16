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

import { isEqual } from "lodash";
import { useCallback } from "react";
import create, { StoreApi } from "zustand";
import createContext from "zustand/context";

import type { HoverValue } from "@foxglove/studio-base/types/hoverValue";

type HoverValueStore = Readonly<{
  value: undefined | HoverValue;
  clearHoverValue: (componentId: string) => void;
  setHoverValue: (value: HoverValue) => void;
}>;

const { Provider, useStore } = createContext<StoreApi<HoverValueStore>>();

function createHoverValueStore(): StoreApi<HoverValueStore> {
  return create((set) => {
    return {
      value: undefined,
      clearHoverValue: (componentId) =>
        set((store) => ({
          value: store.value?.componentId === componentId ? undefined : store.value,
        })),
      setHoverValue: (newValue: HoverValue) =>
        set((store) => ({ value: isEqual(newValue, store.value) ? store.value : newValue })),
    };
  });
}

const selectClearHoverValue = (store: HoverValueStore) => store.clearHoverValue;

export function useClearHoverValue(): HoverValueStore["clearHoverValue"] {
  return useStore(selectClearHoverValue);
}

const selectSetHoverValue = (store: HoverValueStore) => store.setHoverValue;

export function useSetHoverValue(): HoverValueStore["setHoverValue"] {
  return useStore(selectSetHoverValue);
}

export function useHoverValue(args?: {
  componentId: string;
  isTimestampScale: boolean;
}): HoverValue | undefined {
  const hasArgs = !!args;
  const componentId = args?.componentId;
  const isTimestampScale = args?.isTimestampScale ?? false;

  const selector = useCallback(
    (store: HoverValueStore) => {
      if (!hasArgs) {
        // Raw form -- user needs to check that the value should be shown.
        return store.value;
      }
      if (store.value == undefined) {
        return undefined;
      }
      if (store.value.type === "PLAYBACK_SECONDS" && isTimestampScale) {
        // Always show playback-time hover values for timestamp-based charts.
        return store.value;
      }
      // Otherwise just show hover bars when hovering over the panel itself.
      return store.value.componentId === componentId ? store.value : undefined;
    },
    [hasArgs, componentId, isTimestampScale],
  );

  return useStore(selector);
}

export function HoverValueProvider({ children }: React.PropsWithChildren<unknown>): JSX.Element {
  return <Provider createStore={createHoverValueStore}>{children}</Provider>;
}
