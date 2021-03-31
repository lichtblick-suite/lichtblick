// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { useMemo } from "react";
import { useAsyncFn, useAsyncRetry } from "react-use";
import type { AsyncState } from "react-use/lib/useAsyncFn";

import { useAppConfiguration } from "@foxglove-studio/app/context/AppConfigurationContext";

// Load a value from app configuration and provide a function to change it.
// The `state` returned can be used to show whether the get/set is still in progress.
export function useAsyncAppConfigurationValue<T>(
  key: string,
): [state: AsyncState<T>, setter: (value: T) => Promise<void>] {
  const appConfiguration = useAppConfiguration();

  // async retry will start loading the value on mount
  const getterState = useAsyncRetry(async () => (await appConfiguration.get(key)) as T, [
    appConfiguration,
    key,
  ]);

  const [setterState, setter] = useAsyncFn(
    async (value: T) => {
      await appConfiguration.set(key, value);
      getterState.retry(); // re-trigger the getter so the new value is displayed
    },
    [appConfiguration, key, getterState],
  );

  const state = useMemo(() => {
    return setterState.loading || setterState.error
      ? { ...setterState, value: undefined }
      : { ...getterState, retry: undefined };
  }, [setterState, getterState]);

  return [state, setter];
}
