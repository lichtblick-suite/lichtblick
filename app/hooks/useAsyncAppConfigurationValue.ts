// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { useLayoutEffect } from "react";
import { useAsyncFn } from "react-use";
import { AsyncState } from "react-use/lib/useAsyncFn";

import { useAppConfiguration } from "@foxglove-studio/app/context/AppConfigurationContext";

// Load a value from app configuration and provide a function to change it.
// The `state` returned can be used to show whether the get/set is still in progress.
export function useAsyncAppConfigurationValue<T>(
  key: string,
): [state: AsyncState<T>, setter: (value: T) => Promise<void>] {
  const appConfiguration = useAppConfiguration();
  const [getterState, getter] = useAsyncFn(async () => (await appConfiguration.get(key)) as T, [
    appConfiguration,
    key,
  ]);

  // Start loading the current value on first render
  useLayoutEffect(() => {
    getter();
  }, [getter]);

  const [setterState, setter] = useAsyncFn(
    async (value: T) => {
      await appConfiguration.set(key, value);
      getter(); // re-trigger the getter so the new value is displayed
    },
    [appConfiguration, key, getter],
  );

  const state =
    setterState.loading || setterState.error ? { ...setterState, value: undefined } : getterState;
  return [state, setter];
}
