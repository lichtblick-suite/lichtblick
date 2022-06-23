// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useCallback, useContext, useMemo } from "react";

import Logger from "@foxglove/log";

export type ExtensionInfo = {
  id: string;
  description: string;
  displayName: string;
  homepage: string;
  keywords: string[];
  license: string;
  name: string;
  namespace?: string;
  publisher: string;
  qualifiedName: string;
  version: string;
};

export type ExtensionNamespace = "local" | "private";

export interface ExtensionLoader {
  readonly namespace: ExtensionNamespace;

  // get a list of installed extensions
  getExtensions(): Promise<ExtensionInfo[]>;

  // load the source code for a specific extension
  loadExtension(id: string): Promise<string>;

  // install extension contained within the file data
  installExtension(foxeFileData: Uint8Array): Promise<ExtensionInfo>;

  // uninstall extension with id
  // return true if the extension was found and uninstalled, false if not found
  uninstallExtension(id: string): Promise<boolean>;
}

const log = Logger.getLogger(__filename);

const ExtensionLoaderContext = createContext<readonly ExtensionLoader[]>([]);
ExtensionLoaderContext.displayName = "ExtensionLoaderContext";

type AggregateExtensionLoader = Omit<ExtensionLoader, "namespace" | "installExtension"> & {
  downloadExtension(url: string): Promise<Uint8Array>;
  installExtension(namespace: ExtensionNamespace, foxeFileData: Uint8Array): Promise<ExtensionInfo>;
};

/**
 * Presents a unified interface for all enabled extension loaders, wrapping the
 * set of all loaders in a single API.
 *
 * Extensions are segregated into separate namespaces but their IDs must be globally
 * unique in order to be referenced in panel layouts so this hook provides a partial
 * wrapper over a set of loaders.
 */
export function useExtensionLoader(): AggregateExtensionLoader {
  const loaders = useContext(ExtensionLoaderContext);

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

export default ExtensionLoaderContext;
