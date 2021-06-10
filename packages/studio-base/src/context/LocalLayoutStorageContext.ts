// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { LocalLayoutStorage } from "@foxglove/studio-base/services/LocalLayoutStorage";

const LocalLayoutStorageContext = createContext<LocalLayoutStorage | undefined>(undefined);

export function useLocalLayoutStorage(): LocalLayoutStorage {
  const ctx = useContext(LocalLayoutStorageContext);
  if (ctx === undefined) {
    throw new Error("A LocalLayoutStorage provider is required to useLocalLayoutStorage");
  }
  return ctx;
}

export default LocalLayoutStorageContext;
