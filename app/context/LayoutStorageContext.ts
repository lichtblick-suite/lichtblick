// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { PanelsState } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";

export type Layout = {
  id: string;
  name: string;
  state?: PanelsState;
};

export interface LayoutStorage {
  list(): Promise<Layout[]>;
  get(id: string): Promise<Layout | undefined>;
  put(layout: Layout): Promise<void>;
  delete(id: string): Promise<void>;
}

const LayoutStorageContext = createContext<LayoutStorage | undefined>(undefined);

export function useLayoutStorage(): LayoutStorage {
  const ctx = useContext(LayoutStorageContext);
  if (ctx === undefined) {
    throw new Error("A LayoutStorage provider is required to useLayoutStorage");
  }
  return ctx;
}

export default LayoutStorageContext;
