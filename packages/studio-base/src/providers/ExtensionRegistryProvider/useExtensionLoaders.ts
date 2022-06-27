// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useMemo } from "react";

import Logger from "@foxglove/log";
import { ExtensionLoader } from "@foxglove/studio-base/services/ExtensionLoader";
import { ExtensionInfo, ExtensionNamespace } from "@foxglove/studio-base/types/Extensions";

type AggregateExtensionLoader = Omit<ExtensionLoader, "namespace" | "installExtension"> & {
  downloadExtension(url: string): Promise<Uint8Array>;
  installExtension(namespace: ExtensionNamespace, foxeFileData: Uint8Array): Promise<ExtensionInfo>;
};

const log = Logger.getLogger(__filename);

/**
 * Presents a unified interface for all enabled extension loaders, wrapping the
 * set of all loaders in a single API.
 *
 * Extensions are segregated into separate namespaces but their IDs must be globally
 * unique in order to be referenced in panel layouts so this hook provides a partial
 * wrapper over a set of loaders.
 */
export function useExtensionLoaders(loaders: readonly ExtensionLoader[]): AggregateExtensionLoader {
  const getExtensions = useCallback(
    async () =>
      (await Promise.all(loaders.map(async (loader) => await loader.getExtensions())))
        .flat()
        .sort(),
    [loaders],
  );

  const loadExtension = useCallback(
    async (id: string) => {
      for (const loader of loaders) {
        try {
          return await loader.loadExtension(id);
        } catch (error) {
          log.debug(error);
        }
      }

      throw new Error(`Extension ${id} not found`);
    },
    [loaders],
  );

  const downloadExtension = useCallback(async (url: string) => {
    const res = await fetch(url);
    return new Uint8Array(await res.arrayBuffer());
  }, []);

  const installExtension = useCallback(
    async (namespace: ExtensionNamespace, foxeFileData: Uint8Array) => {
      const namespacedLoader = loaders.find((loader) => loader.namespace === namespace);
      if (namespacedLoader == undefined) {
        throw new Error("No extension loader found for namespace " + namespace);
      }
      return await namespacedLoader.installExtension(foxeFileData);
    },
    [loaders],
  );

  const uninstallExtension = useCallback(
    async (id: string) => {
      for (const loader of loaders) {
        try {
          return await loader.uninstallExtension(id);
        } catch (error) {
          log.debug(error);
        }
      }

      throw new Error(`Extension ${id} not found`);
    },
    [loaders],
  );

  const value = useMemo(
    () => ({
      downloadExtension,
      getExtensions,
      installExtension,
      loadExtension,
      uninstallExtension,
    }),
    [downloadExtension, getExtensions, installExtension, loadExtension, uninstallExtension],
  );

  return value;
}
