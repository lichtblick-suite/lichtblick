// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useState } from "react";

import { ILayoutCache, LayoutCacheContext } from "@foxglove/studio-base";

export default function NoOpLayoutCacheProvider(props: PropsWithChildren<unknown>): JSX.Element {
  const [ctx] = useState<ILayoutCache>(() => {
    return {
      async list() {
        return [];
      },
      async get() {
        return undefined;
      },
      async put() {
        return undefined;
      },
      async delete() {
        return undefined;
      },
    };
  });

  return <LayoutCacheContext.Provider value={ctx}>{props.children}</LayoutCacheContext.Provider>;
}
