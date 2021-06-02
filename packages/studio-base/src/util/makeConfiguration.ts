// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  AppConfiguration,
  AppConfigurationValue,
} from "@foxglove/studio-base/context/AppConfigurationContext";

export function makeConfiguration(entries?: [string, AppConfigurationValue][]): AppConfiguration {
  const map = new Map<string, AppConfigurationValue>(entries);
  const listeners = new Set<(newValue: AppConfigurationValue) => void>();
  return {
    get: (key: string) => map.get(key),
    set: async (key: string, value: AppConfigurationValue) => {
      map.set(key, value);
      [...listeners].forEach((listener) => listener(value));
    },
    addChangeListener: (_key, cb) => listeners.add(cb),
    removeChangeListener: (_key, cb) => listeners.delete(cb),
  };
}
