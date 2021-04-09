// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAsyncFn, useAsyncRetry } from "react-use";

import { useAppConfiguration } from "@foxglove-studio/app/context/AppConfigurationContext";

type Options = {
  // If true, a newly set value will be returned from the hook even while the setter is still in progress.
  optimistic?: boolean;
};

// Like AsyncState<T>, but allowing `loading: true` & `value` to be present at the same time.
type OptimisticState<T> =
  | { loading: boolean; error?: undefined; value?: T }
  | { loading: true; error?: Error | undefined; value?: T }
  | { loading: false; error: Error; value?: undefined }
  | { loading: false; error?: undefined; value: T };

// Load a value from app configuration and provide a function to change it.
// The `state` returned can be used to show whether the get/set is still in progress.
export function useAsyncAppConfigurationValue<T>(
  key: string,
  { optimistic = false }: Options = {},
): [state: OptimisticState<T | undefined>, setter: (value?: T) => Promise<void>] {
  const appConfiguration = useAppConfiguration();

  // async retry will start loading the value on mount
  const getterState = useAsyncRetry(
    async () => (await appConfiguration.get(key)) as T | undefined,
    [appConfiguration, key],
  );
  const { retry } = getterState;

  useEffect(() => {
    const listener = () => retry();
    appConfiguration.addChangeListener(key, listener);
    return () => appConfiguration.removeChangeListener(key, listener);
  }, [key, appConfiguration, retry]);

  const [optimisticValue, setOptimisticValue] = useState<T | undefined>(undefined);
  const [setterState, setter] = useAsyncFn(
    async (value?: T) => await appConfiguration.set(key, value),
    [appConfiguration, key],
  );

  const state = useMemo(() => {
    return setterState.loading
      ? { ...setterState, value: optimistic ? optimisticValue : undefined }
      : setterState.error
      ? { ...setterState, value: undefined }
      : getterState.loading
      ? {
          ...getterState,
          value: (optimistic ? optimisticValue : undefined) ?? getterState.value,
          retry: undefined,
        }
      : { ...getterState, retry: undefined };
  }, [setterState, getterState, optimistic, optimisticValue]);

  const wrappedSetter = useCallback(
    (value?: T) => {
      setOptimisticValue(value);
      return setter(value);
    },
    [setter],
  );

  return [state, wrappedSetter];
}
