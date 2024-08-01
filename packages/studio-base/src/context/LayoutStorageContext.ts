// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ILayoutStorage } from "@lichtblick/studio-base/services/ILayoutStorage";
import { createContext, useContext } from "react";

const LayoutStorageContext = createContext<ILayoutStorage | undefined>(undefined);
LayoutStorageContext.displayName = "LayoutStorageContext";

export function useLayoutStorage(): ILayoutStorage {
  const ctx = useContext(LayoutStorageContext);
  if (ctx == undefined) {
    throw new Error("A LayoutStorage provider is required to useLayoutStorage");
  }
  return ctx;
}

export default LayoutStorageContext;
