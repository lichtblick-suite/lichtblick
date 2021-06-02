// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useCallback, useContext, useState } from "react";
import { URDFRobot } from "urdf-loader";
import { v4 as uuidv4 } from "uuid";

import { useShallowMemo } from "@foxglove/hooks";

export type Asset = { name: string } & { type: "urdf"; model: URDFRobot };
type AssetWithUUID = Asset & { uuid: string };

type Assets = {
  /** Returns true if the file was successfully loaded as an asset. */
  loadFromFile: (file: File, options: { basePath: string | undefined }) => Promise<boolean>;
  assets: readonly AssetWithUUID[];
};

const AssetsContext = createContext<Assets>({
  loadFromFile: async () => {
    throw new Error("Cannot load assets outside AssetsProvider");
  },
  assets: [],
});

export interface AssetLoader {
  /**
   * @returns A successfully loaded asset, or undefined if this loader should not be used to load this asset.
   */
  load(file: File, options: { basePath: string | undefined }): Promise<Asset | undefined>;
}

export function useAssets(): Assets {
  return useContext(AssetsContext);
}

export function AssetsProvider({
  loaders,
  children,
}: React.PropsWithChildren<{ loaders: AssetLoader[] }>): React.ReactElement {
  const [assets, setAssets] = useState<AssetWithUUID[]>([]);

  const value: Assets = useShallowMemo({
    assets,
    loadFromFile: useCallback(
      async (file, options) => {
        for (const loader of loaders) {
          const result = await loader.load(file, options);
          if (result != undefined) {
            setAssets((items) =>
              items
                .concat({ ...result, uuid: uuidv4() })
                .sort((a, b) => a.name.localeCompare(b.name)),
            );
            return true;
          }
        }
        return false;
      },
      [loaders],
    ),
  });

  return <AssetsContext.Provider value={value}>{children}</AssetsContext.Provider>;
}

export default AssetsContext;
