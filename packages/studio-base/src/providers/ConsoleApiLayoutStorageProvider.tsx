// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useMemo } from "react";
import { useToasts } from "react-toast-notifications";
import { useInterval, useNetworkState } from "react-use";

import { useShallowMemo, useVisibilityState } from "@foxglove/hooks";
import Logger from "@foxglove/log";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { useConsoleApi } from "@foxglove/studio-base/context/ConsoleApiContext";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import { useLayoutCache } from "@foxglove/studio-base/context/LayoutCacheContext";
import LayoutStorageContext from "@foxglove/studio-base/context/LayoutStorageContext";
import LayoutStorageDebuggingContext from "@foxglove/studio-base/context/LayoutStorageDebuggingContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import CacheOnlyLayoutStorage from "@foxglove/studio-base/services/CacheOnlyLayoutStorage";
import ConsoleApiRemoteLayoutStorage from "@foxglove/studio-base/services/ConsoleApiRemoteLayoutStorage";
import { LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";
import OfflineLayoutStorage from "@foxglove/studio-base/services/OfflineLayoutStorage";

const log = Logger.getLogger(__filename);

const SYNC_INTERVAL = 15_000;

export default function ConsoleApiLayoutStorageProvider({
  children,
}: React.PropsWithChildren<unknown>): JSX.Element {
  const { addToast } = useToasts();
  const [enableConsoleApiLayouts = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_CONSOLE_API_LAYOUTS,
  );
  const api = useConsoleApi();
  const currentUser = useCurrentUser();

  const apiStorage = useMemo(() => new ConsoleApiRemoteLayoutStorage(api), [api]);

  const layoutCache = useLayoutCache();
  const cacheOnlyStorage = useMemo(() => new CacheOnlyLayoutStorage(layoutCache), [layoutCache]);

  const offlineStorage = useMemo(
    () => new OfflineLayoutStorage({ cacheStorage: layoutCache, remoteStorage: apiStorage }),
    [layoutCache, apiStorage],
  );

  const sync = useCallback(async () => {
    try {
      const conflicts = await offlineStorage.syncWithRemote();
      log.info("synced, conflicts:", conflicts);
    } catch (error) {
      addToast(`Sync failed: ${error.message}`, {
        id: "ConsoleApiLayoutStorageProvider.syncError",
        appearance: "error",
      });
    }
  }, [addToast, offlineStorage]);

  const { online = false } = useNetworkState();
  const visibilityState = useVisibilityState();

  // Sync periodically when logged in, online, and the app is not hidden
  const enableSyncing = currentUser != undefined && online && visibilityState === "visible";
  useEffect(() => {
    if (enableSyncing) {
      void sync();
    }
  }, [enableSyncing, sync]);
  useInterval(
    sync,
    enableSyncing ? SYNC_INTERVAL : null /* eslint-disable-line no-restricted-syntax */,
  );

  const storage = enableConsoleApiLayouts && currentUser ? offlineStorage : cacheOnlyStorage;

  const injectEdit = useCallback(
    async (id: LayoutID) => {
      const layout = await apiStorage.getLayout(id);
      if (!layout) {
        throw new Error("This layout doesn't exist on the server");
      }
      await apiStorage.updateLayout({
        targetID: layout.id,
        name: layout.name,
        data: {
          ...layout.data,
          layout: {
            direction: "row",
            first: `onboarding.welcome!${Math.round(Math.random() * 1e6).toString(36)}`,
            second: layout.data.layout ?? "unknown",
            splitPercentage: 33,
          },
        },
        ifUnmodifiedSince: layout.updatedAt,
      });
    },
    [apiStorage],
  );

  const injectRename = useCallback(
    async (id: LayoutID) => {
      const layout = await apiStorage.getLayout(id);
      if (!layout) {
        throw new Error("This layout doesn't exist on the server");
      }
      await apiStorage.updateLayout({
        targetID: layout.id,
        name: `${layout.name} renamed`,
        ifUnmodifiedSince: layout.updatedAt,
      });
    },
    [apiStorage],
  );

  const injectDelete = useCallback(
    async (id: LayoutID) => {
      const layout = await apiStorage.getLayout(id);
      if (!layout) {
        throw new Error("This layout doesn't exist on the server");
      }
      await apiStorage.deleteLayout({ targetID: id, ifUnmodifiedSince: layout.updatedAt });
    },
    [apiStorage],
  );

  const debugging = useShallowMemo({ syncNow: sync, injectEdit, injectRename, injectDelete });

  return (
    <LayoutStorageDebuggingContext.Provider
      value={
        process.env.NODE_ENV !== "production" && enableConsoleApiLayouts && currentUser
          ? debugging
          : undefined
      }
    >
      <LayoutStorageContext.Provider value={storage}>{children}</LayoutStorageContext.Provider>
    </LayoutStorageDebuggingContext.Provider>
  );
}
