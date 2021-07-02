// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { ILayoutCache } from "@foxglove/studio-base/services/ILayoutCache";

const LayoutCacheContext = createContext<ILayoutCache | undefined>(undefined);

export function useLayoutCache(): ILayoutCache {
  const ctx = useContext(LayoutCacheContext);
  if (ctx == undefined) {
    throw new Error("A LayoutCache provider is required to useLayoutCache");
  }
  return ctx;
}

export default LayoutCacheContext;
