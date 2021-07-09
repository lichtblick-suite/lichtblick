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
import { useCallback, useState } from "react";

import { useShallowMemo } from "@foxglove/hooks";
import useContextSelector from "@foxglove/studio-base/hooks/useContextSelector";
import type { HoverValue } from "@foxglove/studio-base/types/hoverValue";
import createSelectableContext from "@foxglove/studio-base/util/createSelectableContext";

type HoverValueContext = Readonly<{
  value: HoverValue | undefined;
  setHoverValue: (value: HoverValue) => void;
  clearHoverValue: (componentId: string) => void;
}>;

const Context = createSelectableContext<HoverValueContext>();

export function useClearHoverValue(): HoverValueContext["clearHoverValue"] {
  return useContextSelector(
    Context,
    useCallback((ctx) => ctx.clearHoverValue, []),
  );
}

export function useSetHoverValue(): HoverValueContext["setHoverValue"] {
  return useContextSelector(
    Context,
    useCallback((ctx) => ctx.setHoverValue, []),
  );
}

export function useHoverValue(args?: {
  componentId: string;
  isTimestampScale: boolean;
}): HoverValue | undefined {
  const hasArgs = !!args;
  const componentId = args?.componentId;
  const isTimestampScale = args?.isTimestampScale ?? false;
  return useContextSelector(
    Context,
    useCallback(
      (ctx) => {
        if (!hasArgs) {
          // Raw form -- user needs to check that the value should be shown.
          return ctx.value;
        }
        if (ctx.value == undefined) {
          return undefined;
        }
        if (ctx.value.type === "PLAYBACK_SECONDS" && isTimestampScale) {
          // Always show playback-time hover values for timestamp-based charts.
          return ctx.value;
        }
        // Otherwise just show hover bars when hovering over the panel itself.
        return ctx.value.componentId === componentId ? ctx.value : undefined;
      },
      [hasArgs, componentId, isTimestampScale],
    ),
  );
}

export function HoverValueProvider({ children }: React.PropsWithChildren<unknown>): JSX.Element {
  const [value, rawSetHoverValue] = useState<HoverValue | undefined>();
  const setHoverValue = useCallback(
    (newValue: HoverValue) =>
      rawSetHoverValue((oldValue) => (isEqual(newValue, oldValue) ? oldValue : newValue)),
    [],
  );
  const clearHoverValue = useCallback((componentId: string) => {
    rawSetHoverValue((currentValue) =>
      currentValue?.componentId === componentId ? undefined : currentValue,
    );
  }, []);
  const providerValue = useShallowMemo({
    value,
    setHoverValue,
    clearHoverValue,
  });
  return <Context.Provider value={providerValue}>{children}</Context.Provider>;
}
