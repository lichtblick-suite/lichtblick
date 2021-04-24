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

import { useRef, useLayoutEffect, useState, useContext } from "react";

import { SelectableContext } from "@foxglove-studio/app/util/createSelectableContext";

import useShouldNotChangeOften from "./useShouldNotChangeOften";

const BAILOUT: unique symbol = Symbol("BAILOUT");

// `useContextSelector(context, selector)` behaves like `selector(useContext(context))`, but
// only triggers a re-render when the selected value actually changes.
//
// Changing the selector will not cause the context to be re-processed, so the selector must
// not have external dependencies that change over time.
//
// `useContextSelector.BAILOUT` can be returned from the selector as a special sentinel that indicates
// no update should occur. (Returning BAILOUT from the first call to selector is not allowed.)
export default function useContextSelector<T, U>(
  context: SelectableContext<T>,
  selector: (arg0: T) => U | typeof BAILOUT,
): U {
  // eslint-disable-next-line no-underscore-dangle
  const handle = useContext(context._ctx);
  if (!handle) {
    throw new Error(`useContextSelector was used outside a corresponding <Provider />.`);
  }

  useShouldNotChangeOften(selector, () =>
    console.warn(
      `useContextSelector() selector (${selector.toString()}) is changing frequently. 
Changing the selector will not cause the current context to be re-processed, 
so you may have a bug if the selector depends on external state. 
Wrap your selector in a useCallback() to silence this warning.`,
    ),
  );

  const [selectedValue, setSelectedValue] = useState(() => {
    const value = selector(handle.currentValue());
    if (value === BAILOUT) {
      throw new Error("Initial selector call must not return BAILOUT");
    }
    return value;
  });

  const latestSelectedValue = useRef<symbol | U>();
  useLayoutEffect(() => {
    latestSelectedValue.current = selectedValue;
  });

  // Subscribe to context updates, and setSelectedValue() only when the selected value changes.
  useLayoutEffect(() => {
    const sub = (newValue: T) => {
      const newSelectedValue = selector(newValue);
      if (newSelectedValue === BAILOUT) {
        return;
      }
      if (newSelectedValue !== latestSelectedValue.current) {
        // Because newSelectedValue might be a function, we have to always use the reducer form of setState.
        setSelectedValue(() => newSelectedValue);
      }
    };
    handle.addSubscriber(sub);
    return () => {
      handle.removeSubscriber(sub);
    };
  }, [handle, selector]);

  return selectedValue;
}

useContextSelector.BAILOUT = BAILOUT;
