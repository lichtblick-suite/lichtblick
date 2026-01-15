// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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
  LoadExtensionsResult,
} from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { buildContributionPoints } from "@lichtblick/suite-base/providers/helpers/buildContributionPoints";
import { IExtensionLoader } from "@lichtblick/suite-base/services/extension/IExtensionLoader";
import { Namespace } from "@lichtblick/suite-base/types";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";

const log = Logger.getLogger(__filename);

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
      const results = await promisesInBatch(extensions, namespaceLoaders);
      return results;
    };

    async function promisesInBatch(
      batch: ExtensionData[],
      extensionLoaders: IExtensionLoader[],
    ): Promise<InstallExtensionsResult[]> {
      return await Promise.all(
        batch.map(async (extension: ExtensionData) => {
          const loaderResults: Array<LoadExtensionsResult> = [];
          let extensionName = extension.file?.name ?? "Unknown extension";
          let mergedInfo: ExtensionInfo | undefined;
          let hasAnySuccess = false;
          let externalId: string | undefined;

          // Sort loaders to prioritize server loaders first (to get externalId)
          const sortedLoaders = _.sortBy(extensionLoaders, (loader) =>
            loader.type === "server" ? 0 : 1,
          );

          for (const loader of sortedLoaders) {
            try {
              const info = await loader.installExtension({
                foxeFileData: extension.buffer,
                file: extension.file,
                externalId: loader.type === "server" ? undefined : externalId,
              });

              // Store externalId from server loader for use in subsequent loaders
              if (loader.type === "server" && info.externalId) {
                externalId = info.externalId;
              }

              extensionName = info.displayName || info.name || extensionName;
              const { raw } = await loader.loadExtension(
                loader.namespace === "org" && loader.type === "server" ? info.externalId! : info.id,
              );
              const unwrappedExtensionSource = raw;
              const contributionPoints = buildContributionPoints(info, unwrappedExtensionSource);

              // Only merge state once for the first successful installation
              if (!hasAnySuccess) {
                get().mergeState(info, contributionPoints);
                get().markExtensionAsInstalled(info.id);
                mergedInfo = info;
                hasAnySuccess = true;
              }

              loaderResults.push({
                loaderType: loader.type,
                success: true,
              });
            } catch (error) {
              loaderResults.push({
                loaderType: loader.type,
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
              });
            }
          }

          if (hasAnySuccess) {
            // At least one loader succeeded
            const failedLoaders = loaderResults.filter((result) => !result.success);

            return {
              success: true,
              info: mergedInfo!,
              extensionName,
              loaderResults,
              error: failedLoaders.length > 0 ? new Error("Some loaders failed") : undefined,
            };
          } else {
            return {
              success: false,
              error: new Error("All loaders failed"),
              extensionName,
              loaderResults,
            };
          }
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
      const orgCacheLoader: IExtensionLoader | undefined = loaders.find(
        (extensionLoader) =>
          extensionLoader.namespace === "org" && extensionLoader.type === "browser",
      );
      await Promise.all(
        batch.map(async (extension) => {
          try {
            installedExtensions.push(extension);

            const { messageConverters, panelSettings, panels, topicAliasFunctions, cameraModels } =
              contributionPoints;
            let unwrappedExtensionSource: string = "";

            if (loader.namespace === "org" && loader.type === "server") {
              try {
                if (!orgCacheLoader) {
                  throw new Error("Cache loader not found.");
                }
                // Try to get extension from cache (IndexedDB)
                const { raw } = await orgCacheLoader.loadExtension(extension.id);
                unwrappedExtensionSource = raw;
              } catch {
                // Fallback to remote
                const { raw, buffer } = await loader.loadExtension(extension.externalId!);
                unwrappedExtensionSource = raw;
                if (buffer) {
                  await orgCacheLoader?.installExtension({ foxeFileData: buffer });
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
          await loadInBatch({
            batch: extensions,
            contributionPoints,
            installedExtensions,
            loader,
          });
        } catch (err: unknown) {
          log.error("Error loading extension list", err);
        }
      };

      const localAndRemoteLoaders = loaders.filter(
        (loader) => loader.namespace === "local" || loader.type === "server",
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
      const namespaceLoaders = loaders.filter((loader) => loader.namespace === namespace);
      if (namespaceLoaders.length === 0) {
        throw new Error("No extension loader found for namespace " + namespace);
      }

      let extension: ExtensionInfo | undefined;
      for (const loader of namespaceLoaders) {
        extension = await loader.getExtension(id);
        if (extension) {
          break;
        }
      }

      if (!extension) {
        return;
      }

      for (const loader of namespaceLoaders) {
        try {
          await loader.uninstallExtension(
            loader.type === "server" ? extension.externalId! : extension.id,
          );
        } catch (error) {
          log.warn(
            `Failed to uninstall extension ${extension.id} from loader ${loader.type}:`,
            error,
          );
        }
      }

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
