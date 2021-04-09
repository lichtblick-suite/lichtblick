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

import { useLayoutEffect, useState, createContext, ReactNode, ComponentType, Context } from "react";

export type SubscriberFn<T> = (arg0: T) => void;

export type SelectableContextHandle<T> = {
  currentValue(): T;
  publish(value: T): void;
  addSubscriber(arg0: SubscriberFn<T>): void;
  removeSubscriber(arg0: SubscriberFn<T>): void;
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
    const [handle] = useState<SelectableContextHandle<T>>(() => {
      let currentValue = value;
      const subscribers = new Set<SubscriberFn<T>>();
      return {
        publish(val) {
          currentValue = val;
          for (const sub of subscribers) {
            sub(currentValue);
          }
        },
        currentValue() {
          return currentValue;
        },
        addSubscriber(sub) {
          subscribers.add(sub);
        },
        removeSubscriber(sub) {
          subscribers.delete(sub);
        },
      };
    });

    useLayoutEffect(() => {
      if (value !== handle.currentValue()) {
        handle.publish(value);
      }
    }, [handle /*never changes*/, value]);

    return <ctx.Provider value={handle}>{children}</ctx.Provider>;
  }

  return {
    Provider,
    _ctx: ctx,
  };
}
