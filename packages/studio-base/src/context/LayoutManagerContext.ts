// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { ILayoutManager } from "@foxglove/studio-base/services/ILayoutManager";

const LayoutManagerContext = createContext<ILayoutManager | undefined>(undefined);
LayoutManagerContext.displayName = "LayoutManagerContext";

export function useLayoutManager(): ILayoutManager {
  const ctx = useContext(LayoutManagerContext);
  if (ctx == undefined) {
    throw new Error("A LayoutManager provider is required to useLayoutManager");
  }
  return ctx;
}

export default LayoutManagerContext;
