// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useState } from "react";

import { CachedLayout, ILayoutCache, LayoutCacheContext } from "@foxglove/studio-base";

const KEY_PREFIX = "studio.layout-cache.";

export default function LocalStorageLayoutCacheProvider(
  props: PropsWithChildren<unknown>,
): JSX.Element {
  const [ctx] = useState<ILayoutCache>(() => {
    return {
      async list(): Promise<readonly CachedLayout[]> {
        const results: CachedLayout[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(KEY_PREFIX) === true) {
            const layout = localStorage.getItem(key);
            if (layout != undefined) {
              results.push(JSON.parse(layout));
            }
          }
        }
        return results;
      },

      async get(id: string): Promise<CachedLayout | undefined> {
        const layout = localStorage.getItem(KEY_PREFIX + id);
        return layout == undefined ? undefined : JSON.parse(layout);
      },

      async put(layout: CachedLayout): Promise<void> {
        localStorage.setItem(KEY_PREFIX + layout.id, JSON.stringify(layout));
      },

      async delete(id: string): Promise<void> {
        localStorage.removeItem(KEY_PREFIX + id);
      },
    };
  });

  return <LayoutCacheContext.Provider value={ctx}>{props.children}</LayoutCacheContext.Provider>;
}
