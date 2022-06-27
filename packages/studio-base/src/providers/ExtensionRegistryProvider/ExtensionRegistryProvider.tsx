// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useEffect, useMemo } from "react";
import { useAsyncFn } from "react-use";

import Logger from "@foxglove/log";
import ExtensionRegistryContext from "@foxglove/studio-base/context/ExtensionRegistryContext";
import { ExtensionLoader } from "@foxglove/studio-base/services/ExtensionLoader";
import { ExtensionInfo, ExtensionNamespace } from "@foxglove/studio-base/types/Extensions";

import { useExtensionLoaders } from "./useExtensionLoaders";
import { useExtensionPanels } from "./useExtensionPanels";

const log = Logger.getLogger(__filename);

const NO_EXTENSIONS: ExtensionInfo[] = [];

export default function ExtensionRegistryProvider(
  props: PropsWithChildren<{ loaders: readonly ExtensionLoader[] }>,
): JSX.Element {
  const extensionLoaders = useExtensionLoaders(props.loaders);

  const [registeredExtensions, refreshExtensions] = useAsyncFn(async () => {
    const extensionList = await extensionLoaders.getExtensions();
    log.debug(`Found ${extensionList.length} extension(s)`);
    return extensionList;
  }, [extensionLoaders]);

  const registeredPanels = useExtensionPanels(
    registeredExtensions.value ?? NO_EXTENSIONS,
    extensionLoaders,
  );

  useEffect(() => {
    refreshExtensions().catch((error) => log.error(error));
  }, [refreshExtensions]);

  const value = useMemo(
    () => ({
      downloadExtension: async (url: string) => await extensionLoaders.downloadExtension(url),
      installExtension: async (namespace: ExtensionNamespace, foxeFileData: Uint8Array) => {
        const info = await extensionLoaders.installExtension(namespace, foxeFileData);
        await refreshExtensions();
        return info;
      },
      loadExtension: async (id: string) => await extensionLoaders.loadExtension(id),
      refreshExtensions: async () => {
        await refreshExtensions();
      },
      registeredExtensions: registeredExtensions.value ?? NO_EXTENSIONS,
      registeredPanels: registeredPanels.value ?? {},
      uninstallExtension: async (id: string) => {
        const result = await extensionLoaders.uninstallExtension(id);
        await refreshExtensions();
        return result;
      },
    }),
    [extensionLoaders, refreshExtensions, registeredExtensions.value, registeredPanels.value],
  );

  if (registeredExtensions.error) {
    throw registeredExtensions.error;
  }

  if (!registeredExtensions.value) {
    return <></>;
  }

  return (
    <ExtensionRegistryContext.Provider value={value}>
      {props.children}
    </ExtensionRegistryContext.Provider>
  );
}
