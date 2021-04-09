// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

// Exposes an interface for reading and writing user-configurable options and other persistent application state.
export interface AppConfiguration {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown): Promise<void>;
  addChangeListener(key: string, cb: () => void): void;
  removeChangeListener(key: string, cb: () => void): void;
}

const AppConfigurationContext = createContext<AppConfiguration | undefined>(undefined);

export function useAppConfiguration(): AppConfiguration {
  const storage = useContext(AppConfigurationContext);
  if (!storage) {
    throw new Error("An AppConfigurationContext provider is required to useAppConfiguration");
  }
  return storage;
}

export default AppConfigurationContext;
