// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useMemo } from "react";

import { useShallowMemo } from "@foxglove/hooks";
import Logger from "@foxglove/log";
import {
  OfflineLayoutStorage,
  useAppConfigurationValue,
  AppSetting,
  useLayoutCache,
  LayoutStorageContext,
  LayoutStorageDebuggingContext,
  LayoutID,
} from "@foxglove/studio-base";

import { Desktop } from "../../common/types";
import { useNativeStorage } from "../context/NativeStorageContext";
import FakeRemoteLayoutStorage from "../services/FakeRemoteLayoutStorage";

const desktopBridge = (global as unknown as { desktopBridge: Desktop }).desktopBridge;
const log = Logger.getLogger(__filename);

export default function FakeLayoutStorageProviders({
  children,
}: React.PropsWithChildren<unknown>): JSX.Element {
  const [useFakeRemoteLayoutStorage = false] = useAppConfigurationValue<boolean>(
    AppSetting.FAKE_REMOTE_LAYOUTS,
  );
  const nativeStorage = useNativeStorage();
  const layoutCache = useLayoutCache();
  const fakeRemoteStorage = useMemo(
    () => new FakeRemoteLayoutStorage(nativeStorage),
    [nativeStorage],
  );

  const offlineStorage = useMemo(
    () => new OfflineLayoutStorage({ cacheStorage: layoutCache, remoteStorage: fakeRemoteStorage }),
    [layoutCache, fakeRemoteStorage],
  );
  const openFakeStorageDirectory = useCallback(async () => {
    await desktopBridge.debug_openFakeRemoteLayoutStorageDirectory();
  }, []);
  const syncNow = useCallback(async () => {
    const conflicts = await offlineStorage.syncWithRemote();
    log.info("synced, conflicts:", conflicts);
  }, [offlineStorage]);

  const injectEdit = useCallback(
    async (id: LayoutID) => {
      const layout = await fakeRemoteStorage.getLayout(id);
      if (!layout) {
        throw new Error("This layout doesn't exist on the server");
      }
      await fakeRemoteStorage.updateLayout({
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
    [fakeRemoteStorage],
  );

  const injectRename = useCallback(
    async (id: LayoutID) => {
      const layout = await fakeRemoteStorage.getLayout(id);
      if (!layout) {
        throw new Error("This layout doesn't exist on the server");
      }
      await fakeRemoteStorage.updateLayout({
        targetID: layout.id,
        name: `${layout.name} renamed`,
        ifUnmodifiedSince: layout.updatedAt,
      });
    },
    [fakeRemoteStorage],
  );

  const injectDelete = useCallback(
    async (id: LayoutID) => {
      const layout = await fakeRemoteStorage.getLayout(id);
      if (!layout) {
        throw new Error("This layout doesn't exist on the server");
      }
      await fakeRemoteStorage.deleteLayout({ targetID: id, ifUnmodifiedSince: layout.updatedAt });
    },
    [fakeRemoteStorage],
  );

  const debugging = useShallowMemo({
    openFakeStorageDirectory,
    syncNow,
    injectEdit,
    injectRename,
    injectDelete,
  });

  if (!useFakeRemoteLayoutStorage) {
    return <>{children}</>;
  }
  return (
    <LayoutStorageDebuggingContext.Provider
      value={process.env.NODE_ENV !== "production" ? debugging : undefined}
    >
      <LayoutStorageContext.Provider value={offlineStorage}>
        {children}
      </LayoutStorageContext.Provider>
    </LayoutStorageDebuggingContext.Provider>
  );
}
