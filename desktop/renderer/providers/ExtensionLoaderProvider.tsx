// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren } from "react";
import { useAsync } from "react-use";

import Logger from "@foxglove/log";
import { ExtensionLoaderContext, ExtensionLoader, ExtensionDetail } from "@foxglove/studio-base";

import { Desktop } from "../../common/types";

const log = Logger.getLogger(__filename);
const desktopBridge = (global as { desktopBridge?: Desktop }).desktopBridge;

type PackageInfo = {
  name: string;
};

export default function ExtensionLoaderProvider(props: PropsWithChildren<unknown>): JSX.Element {
  const { value: extensionLoader, error } = useAsync(async () => {
    const extensionList = (await desktopBridge?.getExtensions()) ?? [];
    log.debug(`Loaded ${extensionList?.length ?? 0} extension(s)`);

    const extensions = extensionList.map<ExtensionDetail>((item) => {
      const pkgInfo = item.packageJson as PackageInfo;

      return {
        name: pkgInfo.name,
        source: item.source,
      };
    });

    const loader: ExtensionLoader = {
      getExtensions: () => Promise.resolve(extensions),
    };
    return loader;
  }, []);

  if (error) {
    throw error;
  }

  if (!extensionLoader) {
    return <></>;
  }

  return (
    <ExtensionLoaderContext.Provider value={extensionLoader}>
      {props.children}
    </ExtensionLoaderContext.Provider>
  );
}
