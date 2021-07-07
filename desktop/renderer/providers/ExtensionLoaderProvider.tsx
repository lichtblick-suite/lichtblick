// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren } from "react";

import Logger from "@foxglove/log";
import { ExtensionInfo, ExtensionLoaderContext, ExtensionLoader } from "@foxglove/studio-base";

import { Desktop } from "../../common/types";

const log = Logger.getLogger(__filename);
const desktopBridge = (global as { desktopBridge?: Desktop }).desktopBridge;

export default function ExtensionLoaderProvider(props: PropsWithChildren<unknown>): JSX.Element {
  const extensionLoader: ExtensionLoader = {
    async getExtensions(): Promise<ExtensionInfo[]> {
      const extensionList = (await desktopBridge?.getExtensions()) ?? [];
      log.debug(`Loaded ${extensionList?.length ?? 0} extension(s)`);

      const extensions = extensionList.map<ExtensionInfo>((item) => {
        const pkgInfo = item.packageJson as ExtensionInfo;
        return {
          id: item.id,
          name: pkgInfo.displayName,
          displayName: pkgInfo.displayName,
          description: pkgInfo.description,
          publisher: pkgInfo.publisher,
          homepage: pkgInfo.homepage,
          license: pkgInfo.license,
          version: pkgInfo.version,
          keywords: pkgInfo.keywords,
        };
      });

      return extensions;
    },
    async loadExtension(id: string): Promise<string> {
      return (await desktopBridge?.loadExtension(id)) ?? "";
    },
    async downloadExtension(url: string): Promise<Uint8Array> {
      const res = await fetch(url);
      return new Uint8Array(await res.arrayBuffer());
    },
    async installExtension(foxeFileData: Uint8Array): Promise<ExtensionInfo> {
      if (desktopBridge == undefined) {
        throw new Error(`Cannot install extension without a desktopBridge`);
      }
      const detail = await desktopBridge.installExtension(foxeFileData);

      const pkgInfo = detail.packageJson as ExtensionInfo;

      // Unfortunately because we do not provide a subscriber interface for extension loader
      // callers don't have a good way of being notified when the extension list changes
      // instead of working around this we reload the entire display
      window.location.reload();

      return {
        id: detail.id,
        name: pkgInfo.displayName,
        displayName: pkgInfo.displayName,
        description: pkgInfo.description,
        publisher: pkgInfo.publisher,
        homepage: pkgInfo.homepage,
        license: pkgInfo.license,
        version: pkgInfo.version,
        keywords: pkgInfo.keywords,
      };
    },
    async uninstallExtension(id: string): Promise<boolean> {
      const uninstalled = (await desktopBridge?.uninstallExtension(id)) ?? false;

      // see comments for window.location.reload() in installExtension
      window.location.reload();
      return uninstalled;
    },
  };

  return (
    <ExtensionLoaderContext.Provider value={extensionLoader}>
      {props.children}
    </ExtensionLoaderContext.Provider>
  );
}
