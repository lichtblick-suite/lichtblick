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

import {
  useLayoutEffect,
  createContext,
  ReactNode,
  ComponentType,
  Context,
  useRef,
  useMemo,
} from "react";

export type SubscriberFn<T> = (value: T) => void;

export type SelectableContextHandle<T> = {
  currentValue(): T;
  addSubscriber(sub: SubscriberFn<T>): void;
  removeSubscriber(sub: SubscriberFn<T>): void;
};

export type SelectableContext<T> = {
  readonly Provider: ComponentType<{ value: T; children?: ReactNode }>;
  readonly _ctx: Context<SelectableContextHandle<T> | undefined>;
};

// Create a context for use with useContextSelector
export default function createSelectableContext<T>(): SelectableContext<T> {
  // Use a regular React context whose value never changes to provide access to the handle
  // from nested components' calls to useContextSelector.
  const ctx = createContext<SelectableContextHandle<T> | undefined>(undefined);

  function Provider({ value, children }: { value: T; children?: ReactNode }) {
    const valueRef = useRef(value);
    const lastPublishedValueRef = useRef(value);
    const subscribersRef = useRef(new Set<SubscriberFn<T>>());

    // Set the value now -- we want any consumers rendered in the same render pass to immediately see the new value.
    valueRef.current = value;

    const handle = useMemo<SelectableContextHandle<T>>(
      () => ({
        currentValue: () => valueRef.current,
        addSubscriber: (sub) => subscribersRef.current.add(sub),
        removeSubscriber: (sub) => subscribersRef.current.delete(sub),
      }),
      [],
    );

    // Inform all subscribers of the new value. This is necessary if there is a memoized subtree
    // that didn't re-render at the same time as our provider.
    useLayoutEffect(() => {
      if (value !== lastPublishedValueRef.current) {
        lastPublishedValueRef.current = value;
        for (const sub of subscribersRef.current) {
          sub(valueRef.current);
        }
      }
    }, [value]);

    return <ctx.Provider value={handle}>{children}</ctx.Provider>;
  }

  return {
    Provider,
    _ctx: ctx,
  };
}
