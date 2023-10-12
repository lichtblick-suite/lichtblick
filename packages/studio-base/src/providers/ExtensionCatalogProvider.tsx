// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import React, { PropsWithChildren, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { StoreApi, createStore } from "zustand";

import Logger from "@foxglove/log";
import {
  ExtensionContext,
  ExtensionModule,
  RegisterMessageConverterArgs,
  TopicAliasFunction,
} from "@foxglove/studio";
import {
  ExtensionCatalog,
  ExtensionCatalogContext,
  RegisteredPanel,
} from "@foxglove/studio-base/context/ExtensionCatalogContext";
import { TopicAliasFunctions } from "@foxglove/studio-base/players/TopicAliasingPlayer/aliasing";
import { ExtensionLoader } from "@foxglove/studio-base/services/ExtensionLoader";
import { ExtensionInfo, ExtensionNamespace } from "@foxglove/studio-base/types/Extensions";

const log = Logger.getLogger(__filename);

type MessageConverter = RegisterMessageConverterArgs<unknown> & {
  extensionNamespace?: ExtensionNamespace;
};

type ContributionPoints = {
  panels: Record<string, RegisteredPanel>;
  messageConverters: MessageConverter[];
  topicAliasFunctions: TopicAliasFunctions;
};

function activateExtension(
  extension: ExtensionInfo,
  unwrappedExtensionSource: string,
): ContributionPoints {
  // registered panels stored by their fully qualified id
  // the fully qualified id is the extension name + panel name
  const panels: Record<string, RegisteredPanel> = {};

  const messageConverters: RegisterMessageConverterArgs<unknown>[] = [];

  const topicAliasFunctions: ContributionPoints["topicAliasFunctions"] = [];

  log.debug(`Activating extension ${extension.qualifiedName}`);

  const module = { exports: {} };
  const require = (name: string) => {
    return { react: React, "react-dom": ReactDOM }[name];
  };

  const extensionMode =
    process.env.NODE_ENV === "production"
      ? "production"
      : process.env.NODE_ENV === "test"
      ? "test"
      : "development";

  const ctx: ExtensionContext = {
    mode: extensionMode,

    registerPanel: (params) => {
      log.debug(`Extension ${extension.qualifiedName} registering panel: ${params.name}`);

      const fullId = `${extension.qualifiedName}.${params.name}`;
      if (panels[fullId]) {
        log.warn(`Panel ${fullId} is already registered`);
        return;
      }

      panels[fullId] = {
        extensionName: extension.qualifiedName,
        extensionNamespace: extension.namespace,
        registration: params,
      };
    },

    registerMessageConverter: <Src,>(args: RegisterMessageConverterArgs<Src>) => {
      log.debug(
        `Extension ${extension.qualifiedName} registering message converter from: ${args.fromSchemaName} to: ${args.toSchemaName}`,
      );
      messageConverters.push({
        ...args,
        extensionNamespace: extension.namespace,
      } as MessageConverter);
    },

    registerTopicAliases: (aliasFunction: TopicAliasFunction) => {
      topicAliasFunctions.push({ aliasFunction, extensionId: extension.id });
    },
  };

  try {
    // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
    const fn = new Function("module", "require", unwrappedExtensionSource);

    // load the extension module exports
    fn(module, require, {});
    const wrappedExtensionModule = module.exports as ExtensionModule;

    wrappedExtensionModule.activate(ctx);
  } catch (err) {
    log.error(err);
  }

  return {
    panels,
    messageConverters,
    topicAliasFunctions,
  };
}

function createExtensionRegistryStore(
  loaders: readonly ExtensionLoader[],
  mockMessageConverters: readonly RegisterMessageConverterArgs<unknown>[] | undefined,
): StoreApi<ExtensionCatalog> {
  return createStore((set, get) => ({
    downloadExtension: async (url: string) => {
      const res = await fetch(url);
      return new Uint8Array(await res.arrayBuffer());
    },

    installExtension: async (namespace: ExtensionNamespace, foxeFileData: Uint8Array) => {
      const namespacedLoader = loaders.find((loader) => loader.namespace === namespace);
      if (namespacedLoader == undefined) {
        throw new Error("No extension loader found for namespace " + namespace);
      }
      const info = await namespacedLoader.installExtension(foxeFileData);
      await get().refreshExtensions();
      return info;
    },

    refreshExtensions: async () => {
      if (loaders.length === 0) {
        return;
      }

      const start = performance.now();
      const extensionList: ExtensionInfo[] = [];
      const allContributionPoints: ContributionPoints = {
        panels: {},
        messageConverters: [],
        topicAliasFunctions: [],
      };
      for (const loader of loaders) {
        try {
          for (const extension of await loader.getExtensions()) {
            try {
              extensionList.push(extension);
              const unwrappedExtensionSource = await loader.loadExtension(extension.id);
              const contributionPoints = activateExtension(extension, unwrappedExtensionSource);
              Object.assign(allContributionPoints.panels, contributionPoints.panels);
              allContributionPoints.messageConverters.push(...contributionPoints.messageConverters);
              allContributionPoints.topicAliasFunctions.push(
                ...contributionPoints.topicAliasFunctions,
              );
            } catch (err) {
              log.error("Error loading extension", err);
            }
          }
        } catch (err) {
          log.error("Error loading extension list", err);
        }
      }
      log.info(
        `Loaded ${extensionList.length} extensions in ${(performance.now() - start).toFixed(1)}ms`,
      );
      set({
        installedExtensions: extensionList,
        installedPanels: allContributionPoints.panels,
        installedMessageConverters: allContributionPoints.messageConverters,
        installedTopicAliasFunctions: allContributionPoints.topicAliasFunctions,
      });
    },

    // If there are no loaders then we know there will not be any installed extensions
    installedExtensions: loaders.length === 0 ? [] : undefined,

    installedPanels: {},

    installedMessageConverters: mockMessageConverters ?? [],

    installedTopicAliasFunctions: [],

    uninstallExtension: async (namespace: ExtensionNamespace, id: string) => {
      const namespacedLoader = loaders.find((loader) => loader.namespace === namespace);
      if (namespacedLoader == undefined) {
        throw new Error("No extension loader found for namespace " + namespace);
      }
      await namespacedLoader.uninstallExtension(id);
      await get().refreshExtensions();
    },
  }));
}

export default function ExtensionCatalogProvider({
  children,
  loaders,
  mockMessageConverters,
}: PropsWithChildren<{
  loaders: readonly ExtensionLoader[];
  mockMessageConverters?: readonly RegisterMessageConverterArgs<unknown>[];
}>): JSX.Element {
  const [store] = useState(createExtensionRegistryStore(loaders, mockMessageConverters));

  // Request an initial refresh on first mount
  const refreshExtensions = store.getState().refreshExtensions;
  useEffect(() => {
    refreshExtensions().catch((err) => {
      log.error(err);
    });
  }, [refreshExtensions]);

  return (
    <ExtensionCatalogContext.Provider value={store}>{children}</ExtensionCatalogContext.Provider>
  );
}
