// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { useCallback, useEffect, useState } from "react";

import {
  AppConfigurationValue,
  useAppConfiguration,
} from "@foxglove/studio-base/context/AppConfigurationContext";

/**
 * Load a value from app configuration and provide a function to change it
 * This function behaves similarly to useState for a given app configuration key.
 */
export function useAppConfigurationValue<T extends AppConfigurationValue>(
  key: string,
): [value: T | undefined, setter: (value?: T) => Promise<void>] {
  const appConfiguration = useAppConfiguration();

  const [configurationValue, setConfigurationValue] = useState<T | undefined>(() => {
    const val = appConfiguration.get(key) as T | undefined;
    // coerce empty strings into undefined
    if (typeof val === "string" && val.length === 0) {
      return undefined;
    }
    return val;
  });

  useEffect(() => {
    const handler = (val: unknown) => {
      setConfigurationValue(val as T);
    };

    appConfiguration.addChangeListener(key, handler);
    return () => appConfiguration.removeChangeListener(key, handler);
  }, [key, appConfiguration]);

  const wrappedSetter = useCallback(
    async (value?: T) => {
      setConfigurationValue(value);
      return await appConfiguration.set(key, value);
    },
    [appConfiguration, key],
  );

  return [configurationValue, wrappedSetter];
}
