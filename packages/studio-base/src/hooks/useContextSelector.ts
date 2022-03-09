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

import { useLayoutEffect, useContext, useReducer, useRef } from "react";

import { SelectableContext } from "@foxglove/studio-base/util/createSelectableContext";

import { selectWithUnstableIdentityWarning } from "./selectWithUnstableIdentityWarning";

/**
 * `useContextSelector(context, selector)` behaves like `selector(useContext(context))`, but
 * only triggers a re-render when the selected value actually changes.
 */
export default function useContextSelector<T, U>(
  context: SelectableContext<T>,
  selector: (value: T) => U,
): U {
  // eslint-disable-next-line no-underscore-dangle
  const handle = useContext(context._ctx);
  if (!handle) {
    throw new Error(`useContextSelector was used outside a corresponding <Provider />.`);
  }

  const [_, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const state = useRef<
    Readonly<{ contextValue: T; selectedValue: U; selector: (value: T) => U }> | undefined
  >();
  const contextValue = handle.currentValue();

  const shouldUpdate =
    state.current == undefined ||
    contextValue !== state.current.contextValue ||
    selector !== state.current.selector;

  const selectedValue =
    shouldUpdate || !state.current
      ? selectWithUnstableIdentityWarning(contextValue, selector)
      : state.current.selectedValue;

  // Update the state ref in a layout effect to be concurrent mode safe.
  // It would be "unsafe" to update the ref in the render since the render might not "commit"
  useLayoutEffect(() => {
    if (shouldUpdate) {
      state.current = {
        contextValue,
        selectedValue,
        selector,
      };
    }
  });

  // Subscribe to context updates, and trigger a re-render when the selected value changes.
  useLayoutEffect(() => {
    const sub = (newContextValue: T) => {
      const newSelectedValue = selectWithUnstableIdentityWarning(newContextValue, selector);
      if (newSelectedValue !== state.current?.selectedValue) {
        forceUpdate();
      }
      state.current = {
        contextValue: newContextValue,
        selectedValue: newSelectedValue,
        selector,
      };
    };
    handle.addSubscriber(sub);
    return () => {
      handle.removeSubscriber(sub);
    };
  }, [handle, selector]);

  return selectedValue;
}
