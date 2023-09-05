// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useContext, useEffect, useLayoutEffect, useState } from "react";
import { StoreApi, createStore, useStore } from "zustand";

import { useMustNotChange } from "@foxglove/hooks";
import AnalyticsContext from "@foxglove/studio-base/context/AnalyticsContext";
import IAnalytics from "@foxglove/studio-base/services/IAnalytics";

export type ForwardedAnalytics = StoreApi<{ value: IAnalytics }>;

/**
 * Returns a store for forwarding the given context's value, which can be passed to
 * `ForwardAnalyticsContextProvider`.
 */
export function useForwardAnalytics(): ForwardedAnalytics {
  const value = useContext(AnalyticsContext);
  const [store] = useState(() => createStore(() => ({ value })));
  useLayoutEffect(() => {
    store.setState({ value });
  }, [store, value]);
  return store;
}

/**
 * Forwards React context values for analytics between separate React trees. This is used for
 * exposing the Studio internal analytics context to internal extension panels, which are in their
 * own React trees and otherwise can't access context values from the rest of Studio.
 *
 * This component should be rendered in the destination tree, with the `forwardedAnalytics` prop
 * constructed from the `useForwardAnalytics()` hook rendered in the source tree.
 */
export function ForwardAnalyticsContextProvider({
  /** Context to forward. Should be the return value from useForwardAnalytics in the outer tree. */
  forwardedAnalytics,
  children,
}: React.PropsWithChildren<{ forwardedAnalytics: ForwardedAnalytics }>): JSX.Element {
  useMustNotChange(forwardedAnalytics);
  const [store] = useState(() =>
    createStore(() => ({ value: forwardedAnalytics.getState().value })),
  );
  useEffect(() => {
    const unsubscribe = forwardedAnalytics.subscribe(() => {
      store.setState({ value: forwardedAnalytics.getState().value });
    });
    return unsubscribe;
  }, [forwardedAnalytics, store]);
  const { value } = useStore(store);
  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}
