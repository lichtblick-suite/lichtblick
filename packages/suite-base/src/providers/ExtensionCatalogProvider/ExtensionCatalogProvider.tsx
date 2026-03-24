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
import {
  extensionUniqueKey,
  loadSingleExtension,
  serverLoaderFirst,
  tryInstallSingleLoader,
  removeExtensionData,
} from "@lichtblick/suite-base/providers/ExtensionCatalogProvider/utils";
import { buildContributionPoints } from "@lichtblick/suite-base/providers/helpers/buildContributionPoints";
import {
  IExtensionLoader,
  TypeExtensionLoader,
} from "@lichtblick/suite-base/services/extension/IExtensionLoader";
import { Namespace } from "@lichtblick/suite-base/types";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

const log = Logger.getLogger(__filename);

function createExtensionRegistryStore(
  loaders: readonly IExtensionLoader[],
  mockMessageConverters: readonly RegisterMessageConverterArgs<unknown>[] | undefined,
): StoreApi<ExtensionCatalog> {
  const orgCacheLoader: IExtensionLoader | undefined = loaders.find(
    (extensionLoader) => extensionLoader.namespace === "org" && extensionLoader.type === "browser",
  );

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
      const namespaceLoaders = loaders.filter((loader) => loader.namespace === namespace);
      if (namespaceLoaders.length === 0) {
        throw new Error(`No extension loader found for namespace ${namespace}`);
      }
      return await promisesInBatch(extensions, namespaceLoaders);
    };

    // Installs a single extension through all matching loaders sequentially.
    // Extracted from the promisesInBatch map callback to keep nesting within 4 levels.
    async function installExtensionWithLoaders(
      extension: ExtensionData,
      extensionLoaders: IExtensionLoader[],
    ): Promise<InstallExtensionsResult> {
      const loaderResults: Array<LoadExtensionsResult> = [];
      let extensionName = extension.file?.name ?? "Unknown extension";
      let mergedInfo: ExtensionInfo | undefined;
      let hasAnySuccess = false;
      let externalId: string | undefined;

      // Sort loaders to prioritize server loaders first (to get externalId)
      const sortedLoaders = _.sortBy(extensionLoaders, serverLoaderFirst);

      for (const loader of sortedLoaders) {
        const result = await tryInstallSingleLoader(loader, extension, externalId);

        if (result.success) {
          externalId = result.externalId ?? externalId;
          extensionName = result.info.displayName || result.info.name || extensionName;

          // Only merge state once for the first successful installation
          if (!hasAnySuccess) {
            get().mergeState(result.info, result.contributionPoints);
            get().markExtensionAsInstalled(result.info.id);
            mergedInfo = result.info;
            hasAnySuccess = true;
          }
        }

        loaderResults.push(
          result.success
            ? { loaderType: result.loaderType, success: true }
            : { loaderType: result.loaderType, success: false, error: result.error },
        );
      }

      if (hasAnySuccess) {
        // At least one loader succeeded
        const failedCount = loaderResults.filter((r) => !r.success).length;
        return {
          success: true,
          info: mergedInfo!,
          extensionName,
          loaderResults,
          error: failedCount > 0 ? new Error("Some loaders failed") : undefined,
        };
      }

      return {
        success: false,
        error: new Error("All loaders failed"),
        extensionName,
        loaderResults,
      };
    }

    async function promisesInBatch(
      batch: ExtensionData[],
      extensionLoaders: IExtensionLoader[],
    ): Promise<InstallExtensionsResult[]> {
      return await Promise.all(
        batch.map(
          async (extension) => await installExtensionWithLoaders(extension, extensionLoaders),
        ),
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
        installedExtensions: _.uniqBy(
          [info, ...(state.installedExtensions ?? [])],
          extensionUniqueKey,
        ),
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

    // Loads and registers a single extension from one loader into the shared
    // contribution points and installed-extensions list.
    // Extracted from the loadInBatch map callback to keep nesting within 4 levels.
    async function loadAndRegisterExtension(
      extension: ExtensionInfo,
      loader: IExtensionLoader,
      installedExtensions: ExtensionInfo[],
      contributionPoints: ContributionPoints,
    ): Promise<void> {
      try {
        installedExtensions.push(extension);

        const { messageConverters, panelSettings, panels, topicAliasFunctions, cameraModels } =
          contributionPoints;
        const unwrappedExtensionSource = await loadSingleExtension(
          extension,
          loader,
          orgCacheLoader,
        );
        const newContributionPoints = buildContributionPoints(extension, unwrappedExtensionSource);

        _.assign(panels, newContributionPoints.panels);
        _.merge(panelSettings, newContributionPoints.panelSettings);
        messageConverters.push(...newContributionPoints.messageConverters);
        topicAliasFunctions.push(...newContributionPoints.topicAliasFunctions);

        for (const [name, builder] of newContributionPoints.cameraModels) {
          if (cameraModels.has(name)) {
            log.warn(`Camera model "${name}" already registered, skipping.`);
            continue;
          }
          cameraModels.set(name, builder);
        }

        get().markExtensionAsInstalled(extension.id);
      } catch (err) {
        log.error(`Error loading extension ${extension.id}`, err);
      }
    }

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
      await Promise.all(
        batch.map(async (extension) => {
          await loadAndRegisterExtension(
            extension,
            loader,
            installedExtensions,
            contributionPoints,
          );
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

    const uninstallExtension = async (namespace: Namespace, id: string) => {
      const localLoaderType = isDesktopApp() ? "filesystem" : "browser";
      const loaderType: TypeExtensionLoader = namespace === "local" ? localLoaderType : "server";

      const namespaceLoader = loaders.find(
        (loader) => loader.namespace === namespace && loader.type === loaderType,
      );
      if (!namespaceLoader) {
        throw new Error("No extension loader found for namespace " + namespace);
      }

      const extension = get().installedExtensions?.find(
        (ext) => ext.id === id && ext.namespace === namespace,
      );

      if (!extension) {
        return;
      }

      try {
        await namespaceLoader.uninstallExtension(
          loaderType === "server" ? extension.externalId! : extension.id,
        );
      } catch (error) {
        log.warn(
          `Failed to uninstall extension ${extension.id} from loader ${namespaceLoader.type}:`,
          error,
        );
      }

      set((state) =>
        removeExtensionData({ id: extension.id, namespace: extension.namespace!, state }),
      );

      const stillInstalled = get().installedExtensions?.some((ext) => ext.id === id) ?? false;
      if (!stillInstalled) {
        get().unMarkExtensionAsInstalled(id);
      }
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
