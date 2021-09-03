// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useMemo } from "react";
import { useInterval, useNetworkState } from "react-use";

import { useShallowMemo, useVisibilityState } from "@foxglove/hooks";
import LayoutManagerContext from "@foxglove/studio-base/context/LayoutManagerContext";
import { useLayoutStorage } from "@foxglove/studio-base/context/LayoutStorageContext";
import LayoutStorageDebuggingContext from "@foxglove/studio-base/context/LayoutStorageDebuggingContext";
import { useRemoteLayoutStorage } from "@foxglove/studio-base/context/RemoteLayoutStorageContext";
import { ISO8601Timestamp, LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";
import LayoutManager from "@foxglove/studio-base/services/LayoutManager";

const SYNC_INTERVAL = 15_000;

export default function LayoutManagerProvider({
  children,
}: React.PropsWithChildren<unknown>): JSX.Element {
  const layoutStorage = useLayoutStorage();
  const remoteLayoutStorage = useRemoteLayoutStorage();

  const layoutManager = useMemo(
    () => new LayoutManager({ local: layoutStorage, remote: remoteLayoutStorage }),
    [layoutStorage, remoteLayoutStorage],
  );

  const sync = useCallback(async () => {
    await layoutManager.syncWithRemote();
  }, [layoutManager]);

  const { online = false } = useNetworkState();
  const visibilityState = useVisibilityState();

  // Sync periodically when logged in, online, and the app is not hidden
  const enableSyncing = remoteLayoutStorage != undefined && online && visibilityState === "visible";
  useEffect(() => {
    if (enableSyncing) {
      void sync();
    }
  }, [enableSyncing, sync]);
  useInterval(
    sync,
    enableSyncing ? SYNC_INTERVAL : null /* eslint-disable-line no-restricted-syntax */,
  );

  const injectEdit = useCallback(
    async (id: LayoutID) => {
      const layout = await remoteLayoutStorage?.getLayout(id);
      if (!layout) {
        throw new Error("This layout doesn't exist on the server");
      }
      await remoteLayoutStorage?.updateLayout({
        id: layout.id,
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
        savedAt: new Date().toISOString() as ISO8601Timestamp,
      });
    },
    [remoteLayoutStorage],
  );

  const injectRename = useCallback(
    async (id: LayoutID) => {
      const layout = await remoteLayoutStorage?.getLayout(id);
      if (!layout) {
        throw new Error("This layout doesn't exist on the server");
      }
      await remoteLayoutStorage?.updateLayout({
        id,
        name: `${layout.name} renamed`,
        savedAt: new Date().toISOString() as ISO8601Timestamp,
      });
    },
    [remoteLayoutStorage],
  );

  const injectDelete = useCallback(
    async (id: LayoutID) => {
      await remoteLayoutStorage?.deleteLayout(id);
    },
    [remoteLayoutStorage],
  );

  const debugging = useShallowMemo({ syncNow: sync, injectEdit, injectRename, injectDelete });

  return (
    <LayoutStorageDebuggingContext.Provider
      value={process.env.NODE_ENV !== "production" && remoteLayoutStorage ? debugging : undefined}
    >
      <LayoutManagerContext.Provider value={layoutManager}>
        {children}
      </LayoutManagerContext.Provider>
    </LayoutStorageDebuggingContext.Provider>
  );
}
