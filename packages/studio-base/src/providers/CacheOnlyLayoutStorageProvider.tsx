// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import { useLayoutCache } from "@foxglove/studio-base/context/LayoutCacheContext";
import LayoutStorageContext from "@foxglove/studio-base/context/LayoutStorageContext";
import CacheOnlyLayoutStorage from "@foxglove/studio-base/services/CacheOnlyLayoutStorage";

/**
 * A layout storage provider that's backed by an ILayoutCache. This is used when centralized
 * layout storage is not available because the user is not logged in to an account.
 * @see CacheOnlyLayoutStorage
 */
export default function CacheOnlyLayoutStorageProvider({
  children,
}: React.PropsWithChildren<unknown>): JSX.Element {
  const cache = useLayoutCache();
  const storage = useMemo(() => new CacheOnlyLayoutStorage(cache), [cache]);
  return <LayoutStorageContext.Provider value={storage}>{children}</LayoutStorageContext.Provider>;
}
