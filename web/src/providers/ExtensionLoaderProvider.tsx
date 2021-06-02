// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren } from "react";
import { useAsync } from "react-use";

import Logger from "@foxglove/log";
import { ExtensionDetail, ExtensionLoader, ExtensionLoaderContext } from "@foxglove/studio-base";

const log = Logger.getLogger(__filename);

// example provider showing how to load extensions from a separate js file
export default function ExtensionRegistryProvider(props: PropsWithChildren<unknown>): JSX.Element {
  const { value: registry, error } = useAsync(async () => {
    log.info("Fetching builtin extensions");

    try {
      const builtinExtensionFetch = await fetch("/builtinextensions.js");
      const source = await builtinExtensionFetch.text();

      const extensions: ExtensionDetail[] = [
        {
          name: "builtin",
          source: source,
        },
      ];

      const loader: ExtensionLoader = {
        getExtensions: () => Promise.resolve(extensions),
      };
      return loader;
    } catch (err) {
      log.error(err);

      const loader: ExtensionLoader = {
        getExtensions: () => Promise.resolve([]),
      };
      return loader;
    }
  }, []);

  if (error) {
    throw error;
  }

  if (!registry) {
    return <></>;
  }

  return (
    <ExtensionLoaderContext.Provider value={registry}>
      {props.children}
    </ExtensionLoaderContext.Provider>
  );
}
