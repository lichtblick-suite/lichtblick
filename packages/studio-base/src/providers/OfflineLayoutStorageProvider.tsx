// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import LayoutStorageContext from "@foxglove/studio-base/context/LayoutStorageContext";
import { ILayoutCache } from "@foxglove/studio-base/services/ILayoutCache";
import { IRemoteLayoutStorage } from "@foxglove/studio-base/services/IRemoteLayoutStorage";
import OfflineLayoutStorage from "@foxglove/studio-base/services/OfflineLayoutStorage";

export default function OfflineLayoutStorageProvider({
  cacheStorage,
  remoteStorage,
  children,
}: React.PropsWithChildren<{
  cacheStorage: ILayoutCache;
  remoteStorage: IRemoteLayoutStorage;
}>): JSX.Element {
  const storage = useMemo(
    () => new OfflineLayoutStorage({ cacheStorage, remoteStorage }),
    [cacheStorage, remoteStorage],
  );
  return <LayoutStorageContext.Provider value={storage}>{children}</LayoutStorageContext.Provider>;
}
