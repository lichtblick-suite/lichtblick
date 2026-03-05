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
import { SingleLoaderInstallResult } from "@lichtblick/suite-base/providers/types";
import {
  IExtensionLoader,
  TypeExtensionLoader,
} from "@lichtblick/suite-base/services/extension/IExtensionLoader";
import compareVersions from "@lichtblick/suite-base/services/extension/utils/compareVersions";
import { Namespace } from "@lichtblick/suite-base/types";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

const log = Logger.getLogger(__filename);

// Returns 0 for server loaders (higher priority) and 1 for others, used to
// sort loaders so the server loader runs first during installation.
function serverLoaderFirst(loader: IExtensionLoader): number {
  return loader.type === "server" ? 0 : 1;
}

// Unique key combining id and namespace to allow the same extension to exist
// in multiple scopes simultaneously.
function extensionUniqueKey(ext: ExtensionInfo): string {
  return `${ext.id}-${ext.namespace}`;
}

async function tryLoadFromCache(
  extension: ExtensionInfo,
  orgCacheLoader: IExtensionLoader | undefined,
): Promise<string | undefined> {
  if (!orgCacheLoader) {
    return undefined;
  }
  const cachedExtension = await orgCacheLoader.getExtension(extension.id);
  if (!cachedExtension) {
    log.debug(`No cached version found for extension ${extension.id}, will load from remote.`);
    return undefined;
  }
  const isSameVersion = compareVersions(cachedExtension.version, extension.version) === 0;
  if (!isSameVersion) {
    log.debug(
      `Cached version differs from remote (cached: ${cachedExtension.version}, remote: ${extension.version}), using remote version.`,
    );
    return undefined;
  }
  log.debug(
    `Using cached version of extension ${extension.id} (version ${cachedExtension.version})`,
  );
  const { raw } = await orgCacheLoader.loadExtension(extension.id);
  return raw;
}

async function loadSingleExtension(
  extension: ExtensionInfo,
  loader: IExtensionLoader,
  orgCacheLoader: IExtensionLoader | undefined,
): Promise<string> {
  if (loader.namespace === "org" && loader.type === "server" && extension.externalId) {
    const cachedSource = await tryLoadFromCache(extension, orgCacheLoader).catch((err: unknown) => {
      log.warn(`Cache lookup failed for ${extension.id}, falling back to remote`, err);
      return undefined;
    });

    if (cachedSource == undefined) {
      const { raw, buffer } = await loader.loadExtension(extension.externalId);
      if (buffer && orgCacheLoader) {
        await orgCacheLoader.installExtension({ foxeFileData: buffer }).catch((err: unknown) => {
          log.warn(`Failed to cache extension ${extension.id}`, err);
        });
      }
      return raw;
    }
    return cachedSource;
  }
  const { raw } = await loader.loadExtension(extension.id);
  return raw;
}

function removeExtensionData({
  id, // deleted extension id
  namespace, // deleted extension namespace
  state,
}: {
  id: string;
  namespace: Namespace;
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

  const remainingExtensions = installedExtensions?.filter(
    (ext) => !(ext.id === id && ext.namespace === namespace),
  );

  const stillInstalledElsewhere = remainingExtensions?.some((ext) => ext.id === id) ?? false;

  return {
    installedExtensions: remainingExtensions,
    installedPanels: stillInstalledElsewhere
      ? installedPanels
      : _.pickBy(installedPanels, ({ extensionId }) => extensionId !== id),
    installedMessageConverters: stillInstalledElsewhere
      ? installedMessageConverters
      : installedMessageConverters?.filter(({ extensionId }) => extensionId !== id),
    installedTopicAliasFunctions: stillInstalledElsewhere
      ? installedTopicAliasFunctions
      : installedTopicAliasFunctions?.filter(({ extensionId }) => extensionId !== id),
    installedCameraModels: stillInstalledElsewhere
      ? installedCameraModels
      : new Map([...installedCameraModels].filter(([, { extensionId }]) => extensionId !== id)),
  };
}

// Returns the extension id to use when calling loader.loadExtension after installation.
function getExtensionLoadId(loader: IExtensionLoader, info: ExtensionInfo): string {
  return loader.namespace === "org" && loader.type === "server" ? info.externalId! : info.id;
}

// Attempts to install and load an extension through a single loader.
// Returns a discriminated union so the caller can handle success/failure without try/catch.
async function tryInstallSingleLoader(
  loader: IExtensionLoader,
  extension: ExtensionData,
  currentExternalId: string | undefined,
): Promise<SingleLoaderInstallResult> {
  try {
    const info = await loader.installExtension({
      foxeFileData: extension.buffer,
      file: extension.file,
      externalId: loader.type === "server" ? undefined : currentExternalId,
    });
    const externalId = loader.type === "server" ? info.externalId : undefined;
    const { raw } = await loader.loadExtension(getExtensionLoadId(loader, info));
    const contributionPoints = buildContributionPoints(info, raw);
    return { loaderType: loader.type, success: true, info, contributionPoints, externalId };
  } catch (error) {
    return {
      loaderType: loader.type,
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

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
          [...(state.installedExtensions ?? []), info],
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
