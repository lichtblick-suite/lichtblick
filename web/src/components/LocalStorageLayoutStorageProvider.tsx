// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useState } from "react";

import { filterMap } from "@foxglove/den/collection";
import Log from "@foxglove/log";
import {
  Layout,
  LayoutStorageContext,
  LayoutID,
  ILayoutStorage,
  migrateLayout,
} from "@foxglove/studio-base";

const log = Log.getLogger(__filename);

const KEY_PREFIX = "studio.layouts";

export default function LocalStorageLayoutStorageProvider(
  props: PropsWithChildren<unknown>,
): JSX.Element {
  const [ctx] = useState<ILayoutStorage>(() => {
    return {
      async list(namespace: string): Promise<readonly Layout[]> {
        const results: Layout[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(`${KEY_PREFIX}.${namespace}.`) === true) {
            const layout = localStorage.getItem(key);
            if (layout != undefined) {
              try {
                results.push(migrateLayout(JSON.parse(layout)));
              } catch (err) {
                log.error(err);
              }
            }
          }
        }
        return results;
      },

      async get(namespace: string, id: LayoutID): Promise<Layout | undefined> {
        const layout = localStorage.getItem(`${KEY_PREFIX}.${namespace}.${id}`);
        return layout == undefined ? undefined : migrateLayout(JSON.parse(layout));
      },

      async put(namespace: string, layout: Layout): Promise<Layout> {
        localStorage.setItem(`${KEY_PREFIX}.${namespace}.${layout.id}`, JSON.stringify(layout));
        return layout;
      },

      async delete(namespace: string, id: LayoutID): Promise<void> {
        localStorage.removeItem(`${KEY_PREFIX}.${namespace}.${id}`);
      },

      async importLayouts({
        fromNamespace,
        toNamespace,
      }: {
        fromNamespace: string;
        toNamespace: string;
      }): Promise<void> {
        const keysToMigrate: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(`${KEY_PREFIX}.${fromNamespace}.`) === true) {
            keysToMigrate.push(key);
          }
        }
        for (const key of keysToMigrate) {
          const layout = localStorage.getItem(key);
          if (layout == undefined) {
            continue;
          }
          try {
            const { id } = migrateLayout(JSON.parse(layout));
            localStorage.setItem(`${KEY_PREFIX}.${toNamespace}.${id}`, layout);
            localStorage.removeItem(key);
          } catch (err) {
            log.error(err);
          }
        }
      },

      async migrateUnnamespacedLayouts(namespace: string) {
        // Layouts were previously stored with the un-namespaced prefix "studio.layout-cache".
        const legacyKeys = filterMap(new Array(localStorage.length), (_, i) => {
          const key = localStorage.key(i) ?? undefined;
          return key?.startsWith("studio.layout-cache.") ?? false ? key : undefined;
        });
        for (const key of legacyKeys) {
          const item = localStorage.getItem(key);
          if (item != undefined) {
            try {
              const layout = migrateLayout(JSON.parse(item));
              localStorage.setItem(
                `${KEY_PREFIX}.${namespace}.${layout.id}`,
                JSON.stringify(layout),
              );
              localStorage.removeItem(key);
            } catch (err) {
              log.error(`Migrating ${key}:`, err);
            }
          }
        }
      },
    };
  });

  return (
    <LayoutStorageContext.Provider value={ctx}>{props.children}</LayoutStorageContext.Provider>
  );
}
