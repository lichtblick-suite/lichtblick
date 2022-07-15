// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { createStore, StoreApi } from "zustand";

import Logger from "@foxglove/log";
import { ExtensionContext, ExtensionModule } from "@foxglove/studio";
import {
  ExtensionCatalog,
  ExtensionCatalogContext,
  RegisteredPanel,
  useExtensionCatalog,
} from "@foxglove/studio-base/context/ExtensionCatalogContext";
import { ExtensionLoader } from "@foxglove/studio-base/services/ExtensionLoader";
import { ExtensionInfo, ExtensionNamespace } from "@foxglove/studio-base/types/Extensions";

const log = Logger.getLogger(__filename);

async function registerExtensionPanels(
  extensions: ExtensionInfo[],
  loadExtension: ExtensionLoader["loadExtension"],
): Promise<Record<string, RegisteredPanel>> {
  // registered panels stored by their fully qualified id
  // the fully qualified id is the extension name + panel name
  const panels: Record<string, RegisteredPanel> = {};

  for (const extension of extensions) {
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

      registerPanel(params) {
        log.debug(`Extension ${extension.qualifiedName} registering panel: ${params.name}`);

        const fullId = `${extension.qualifiedName}.${params.name}`;
        if (panels[fullId]) {
          log.warn(`Panel ${fullId} is already registered`);
          return;
        }

        panels[fullId] = {
          extensionName: extension.qualifiedName,
          namespace: extension.namespace,
          registration: params,
        };
      },
    };

    try {
      const unwrappedExtensionSource = await loadExtension(extension.id);

      // eslint-disable-next-line no-new-func
      const fn = new Function("module", "require", unwrappedExtensionSource);

      // load the extension module exports
      fn(module, require, {});
      const wrappedExtensionModule = module.exports as ExtensionModule;

      wrappedExtensionModule.activate(ctx);
    } catch (err) {
      log.error(err);
    }
  }

  return panels;
}

export function createExtensionRegistryStore(
  loaders: readonly ExtensionLoader[],
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

    loadExtension: async (id: string) => {
      for (const loader of loaders) {
        try {
          return await loader.loadExtension(id);
        } catch (error) {
          log.debug(error);
        }
      }

      throw new Error(`Extension ${id} not found`);
    },

    refreshExtensions: async () => {
      const extensionList = (
        await Promise.all(loaders.map(async (loader) => await loader.getExtensions()))
      )
        .flat()
        .sort();
      log.debug(`Found ${extensionList.length} extension(s)`);
      const panels = await registerExtensionPanels(
        extensionList,
        async (id: string) => await get().loadExtension(id),
      );
      set({ installedExtensions: extensionList, installedPanels: panels });
    },

    installedExtensions: undefined,

    installedPanels: undefined,

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

function InitialRefreshAdapter(): ReactNull {
  const refreshExtensions = useExtensionCatalog((state) => state.refreshExtensions);
  useEffect(() => {
    refreshExtensions().catch((err) => log.error(err));
  }, [refreshExtensions]);

  return ReactNull;
}

export default function ExtensionCatalogProvider({
  children,
  loaders,
}: PropsWithChildren<{ loaders: readonly ExtensionLoader[] }>): JSX.Element {
  const [store] = useState(createExtensionRegistryStore(loaders));

  return (
    <ExtensionCatalogContext.Provider value={store}>
      <InitialRefreshAdapter />
      {children}
    </ExtensionCatalogContext.Provider>
  );
}
