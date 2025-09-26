// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import React, { PropsWithChildren, useEffect, useState } from "react";
import { StoreApi, createStore } from "zustand";

import Logger from "@lichtblick/log";
import { RegisterMessageConverterArgs } from "@lichtblick/suite";
import {
  ContributionPoints,
  ExtensionCatalog,
  ExtensionCatalogContext,
  ExtensionData,
  InstallExtensionsResult,
} from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { buildContributionPoints } from "@lichtblick/suite-base/providers/helpers/buildContributionPoints";
import { IExtensionLoader } from "@lichtblick/suite-base/services/extension/IExtensionLoader";
import { IdbExtensionLoader } from "@lichtblick/suite-base/services/extension/IdbExtensionLoader";
import { RemoteExtensionLoader } from "@lichtblick/suite-base/services/extension/RemoteExtensionLoader";
import { Namespace } from "@lichtblick/suite-base/types";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";

const log = Logger.getLogger(__filename);

const MAX_REFRESH_EXTENSIONS_BATCH = 1;
const MAX_INSTALL_EXTENSIONS_BATCH = 1;

function createExtensionRegistryStore(
  loaders: readonly IExtensionLoader[],
  mockMessageConverters: readonly RegisterMessageConverterArgs<unknown>[] | undefined,
): StoreApi<ExtensionCatalog> {
  return createStore((set, get) => {
    const isExtensionInstalled = (extensionId: string) => {
      return get().loadedExtensions.has(extensionId);
    };

    const markExtensionAsInstalled = (extensionId: string) => {
      const updatedExtensions = new Set(get().loadedExtensions);
      updatedExtensions.add(extensionId);
      set({ loadedExtensions: updatedExtensions });
    };

    const unMarkExtensionAsInstalled = (extensionId: string) => {
      const updatedExtensions = new Set(get().loadedExtensions);
      updatedExtensions.delete(extensionId);
      set({ loadedExtensions: updatedExtensions });
    };

    const downloadExtension = async (url: string) => {
      const res = await fetch(url);
      return new Uint8Array(await res.arrayBuffer());
    };

    const installExtensions = async (namespace: Namespace, extensions: ExtensionData[]) => {
      const namespaceLoaders: IExtensionLoader[] = loaders.filter(
        (loader) => loader.namespace === namespace,
      );
      if (namespaceLoaders.length === 0) {
        throw new Error(`No extension loader found for namespace ${namespace}`);
      }
      const results: InstallExtensionsResult[] = [];
      for (let i = 0; i < extensions.length; i += MAX_INSTALL_EXTENSIONS_BATCH) {
        const chunk = extensions.slice(i, i + MAX_INSTALL_EXTENSIONS_BATCH);
        const result = await promisesInBatch(chunk, namespaceLoaders);
        results.push(...result);
      }
      return results;
    };

    async function promisesInBatch(
      batch: ExtensionData[],
      extensionLoaders: IExtensionLoader[],
    ): Promise<InstallExtensionsResult[]> {
      return await Promise.all(
        batch.map(async (extension: ExtensionData) => {
          for (const loader of extensionLoaders) {
            try {
              const info = await loader.installExtension(extension.buffer, extension.file);
              const { raw } = await loader.loadExtension(
                loader.namespace === "org" ? info.externalId! : info.id,
              );
              const unwrappedExtensionSource = raw;
              const contributionPoints = buildContributionPoints(info, unwrappedExtensionSource);

              get().mergeState(info, contributionPoints);
              get().markExtensionAsInstalled(info.id);
              return { success: true, info };
            } catch {
              // Continue to next loader if this one fails
              continue;
            }
          }
          // If all loaders failed, return error
          return {
            success: false,
            error: new Error(`Failed to install extension with any loader`),
          };
        }),
      );
    }

    const mergeState = (
      info: ExtensionInfo,
      {
        messageConverters,
        panelSettings,
        panels,
        topicAliasFunctions,
        cameraModels,
      }: ContributionPoints,
    ) => {
      set((state) => ({
        installedExtensions: _.uniqBy([...(state.installedExtensions ?? []), info], "id"),
        installedPanels: { ...state.installedPanels, ...panels },
        installedMessageConverters: [...state.installedMessageConverters!, ...messageConverters],
        installedTopicAliasFunctions: [
          ...state.installedTopicAliasFunctions!,
          ...topicAliasFunctions,
        ],
        panelSettings: { ...state.panelSettings, ...panelSettings },
        installedCameraModels: new Map([
          ...state.installedCameraModels,
          ...Array.from(cameraModels.entries()),
        ]),
      }));
    };

    async function loadInBatch({
      batch,
      loader,
      installedExtensions,
      contributionPoints,
    }: {
      batch: ExtensionInfo[];
      loader: IExtensionLoader;
      installedExtensions: ExtensionInfo[];
      contributionPoints: ContributionPoints;
    }) {
      const orgLoaderCache: IExtensionLoader | undefined = loaders.find(
        (extensionLoader) =>
          extensionLoader.namespace === "org" && extensionLoader instanceof IdbExtensionLoader,
      );
      await Promise.all(
        batch.map(async (extension) => {
          try {
            installedExtensions.push(extension);

            const { messageConverters, panelSettings, panels, topicAliasFunctions, cameraModels } =
              contributionPoints;
            let unwrappedExtensionSource: string = "";

            if (loader.namespace === "org" && loader instanceof RemoteExtensionLoader) {
              try {
                if (!orgLoaderCache) {
                  throw new Error("Cache loader not found.");
                }
                // Try to get extension from cache (IndexedDB)
                const { raw } = await orgLoaderCache.loadExtension(extension.id);
                unwrappedExtensionSource = raw;
              } catch {
                // Fallback to remote
                const { raw, buffer } = await loader.loadExtension(extension.externalId!);
                unwrappedExtensionSource = raw;
                if (buffer) {
                  await orgLoaderCache?.installExtension(buffer);
                }
              }
            } else {
              const { raw } = await loader.loadExtension(extension.id);
              unwrappedExtensionSource = raw;
            }

            const newContributionPoints = buildContributionPoints(
              extension,
              unwrappedExtensionSource,
            );

            _.assign(panels, newContributionPoints.panels);
            _.merge(panelSettings, newContributionPoints.panelSettings);
            messageConverters.push(...newContributionPoints.messageConverters);
            topicAliasFunctions.push(...newContributionPoints.topicAliasFunctions);

            newContributionPoints.cameraModels.forEach((builder, name: string) => {
              if (cameraModels.has(name)) {
                log.warn(`Camera model "${name}" already registered, skipping.`);
                return;
              }
              cameraModels.set(name, builder);
            });

            get().markExtensionAsInstalled(extension.id);
          } catch (err) {
            log.error(`Error loading extension ${extension.id}`, err);
          }
        }),
      );
    }

    const refreshAllExtensions = async () => {
      log.debug("Refreshing all extensions");
      if (loaders.length === 0) {
        return;
      }

      const start = performance.now();
      const installedExtensions: ExtensionInfo[] = [];
      const contributionPoints: ContributionPoints = {
        messageConverters: [],
        panels: {},
        panelSettings: {},
        topicAliasFunctions: [],
        cameraModels: new Map(),
      };

      const processLoader = async (loader: IExtensionLoader) => {
        try {
          const extensions = await loader.getExtensions();
          const chunks = _.chunk(extensions, MAX_REFRESH_EXTENSIONS_BATCH);
          for (const chunk of chunks) {
            await loadInBatch({
              batch: chunk,
              contributionPoints,
              installedExtensions,
              loader,
            });
          }
        } catch (err: unknown) {
          log.error("Error loading extension list", err);
        }
      };

      const localAndRemoteLoaders = loaders.filter(
        (loader) => loader.namespace === "local" || loader instanceof RemoteExtensionLoader,
      );
      await Promise.all(localAndRemoteLoaders.map(processLoader));

      log.info(
        `Loaded ${installedExtensions.length} extensions in ${(performance.now() - start).toFixed(1)}ms`,
      );

      set({
        installedExtensions,
        installedPanels: contributionPoints.panels,
        installedMessageConverters: contributionPoints.messageConverters,
        installedTopicAliasFunctions: contributionPoints.topicAliasFunctions,
        installedCameraModels: contributionPoints.cameraModels,
        panelSettings: contributionPoints.panelSettings,
      });
    };

    function removeExtensionData({
      id, // deleted extension id
      state,
    }: {
      id: string;
      state: Pick<
        ExtensionCatalog,
        | "installedExtensions"
        | "installedPanels"
        | "installedMessageConverters"
        | "installedTopicAliasFunctions"
        | "installedCameraModels"
      >;
    }) {
      const {
        installedExtensions,
        installedPanels,
        installedMessageConverters,
        installedTopicAliasFunctions,
        installedCameraModels,
      } = state;

      return {
        installedExtensions: installedExtensions?.filter(
          ({ id: extensionId }) => extensionId !== id,
        ),
        installedPanels: _.pickBy(installedPanels, ({ extensionId }) => extensionId !== id),
        installedMessageConverters: installedMessageConverters?.filter(
          ({ extensionId }) => extensionId !== id,
        ),
        installedTopicAliasFunctions: installedTopicAliasFunctions?.filter(
          ({ extensionId }) => extensionId !== id,
        ),
        installedCameraModels: new Map(
          [...installedCameraModels].filter(([, { extensionId }]) => extensionId !== id),
        ),
      };
    }

    const uninstallExtension = async (namespace: Namespace, id: string) => {
      const namespaceLoader = loaders.find((loader) => loader.namespace === namespace);
      if (namespaceLoader == undefined) {
        throw new Error("No extension loader found for namespace " + namespace);
      }

      const extension = await namespaceLoader.getExtension(id);
      if (!extension) {
        return;
      }

      await namespaceLoader.uninstallExtension(extension.id);
      set((state) => removeExtensionData({ id: extension.id, state }));
      get().unMarkExtensionAsInstalled(id);
    };

    return {
      downloadExtension,
      installExtensions,
      isExtensionInstalled,
      markExtensionAsInstalled,
      mergeState,
      refreshAllExtensions,
      uninstallExtension,
      unMarkExtensionAsInstalled,
      installedExtensions: loaders.length === 0 ? [] : undefined,
      installedMessageConverters: mockMessageConverters ?? [],
      installedPanels: {},
      installedTopicAliasFunctions: [],
      installedCameraModels: new Map(),
      loadedExtensions: new Set<string>(),
      panelSettings: _.merge(
        {},
        ...(mockMessageConverters ?? []).map(({ fromSchemaName, panelSettings }) =>
          _.mapValues(panelSettings, (settings) => ({ [fromSchemaName]: settings })),
        ),
      ),
    };
  });
}

export default function ExtensionCatalogProvider({
  children,
  loaders,
  mockMessageConverters,
}: PropsWithChildren<{
  loaders: readonly IExtensionLoader[];
  mockMessageConverters?: readonly RegisterMessageConverterArgs<unknown>[];
}>): React.JSX.Element {
  const [store] = useState(createExtensionRegistryStore(loaders, mockMessageConverters));

  // Request an initial refresh on first mount
  const refreshAllExtensions = store.getState().refreshAllExtensions;
  useEffect(() => {
    refreshAllExtensions().catch((err: unknown) => {
      log.error(err);
    });
  }, [refreshAllExtensions]);

  return (
    <ExtensionCatalogContext.Provider value={store}>{children}</ExtensionCatalogContext.Provider>
  );
}
