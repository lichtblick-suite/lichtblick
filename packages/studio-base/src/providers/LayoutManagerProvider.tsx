// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useVisibilityState } from "@lichtblick/hooks";
import Logger from "@lichtblick/log";
import LayoutManagerContext from "@lichtblick/studio-base/context/LayoutManagerContext";
import { useLayoutStorage } from "@lichtblick/studio-base/context/LayoutStorageContext";
import { useRemoteLayoutStorage } from "@lichtblick/studio-base/context/RemoteLayoutStorageContext";
import { LayoutLoader } from "@lichtblick/studio-base/services/ILayoutLoader";
import LayoutManager from "@lichtblick/studio-base/services/LayoutManager/LayoutManager";
import delay from "@lichtblick/studio-base/util/delay";
import { useEffect, useMemo } from "react";
import { useNetworkState } from "react-use";

const log = Logger.getLogger(__filename);

const SYNC_INTERVAL_BASE_MS = 30_000;
const SYNC_INTERVAL_MAX_MS = 3 * 60_000;

const isFulfilled = <T,>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> =>
  result.status === "fulfilled";

const isRejected = (result: PromiseSettledResult<unknown>): result is PromiseRejectedResult =>
  result.status === "rejected";

export default function LayoutManagerProvider({
  children,
  loaders = [],
}: React.PropsWithChildren<{
  loaders?: readonly LayoutLoader[];
}>): JSX.Element {
  const layoutStorage = useLayoutStorage();
  const remoteLayoutStorage = useRemoteLayoutStorage();

  const layoutManager = useMemo(
    () => new LayoutManager({ local: layoutStorage, remote: remoteLayoutStorage }),
    [layoutStorage, remoteLayoutStorage],
  );

  const { online = false } = useNetworkState();
  const visibilityState = useVisibilityState();
  useEffect(() => {
    layoutManager.setOnline(online);
  }, [layoutManager, online]);

  useEffect(() => {
    if (loaders.length === 0) {
      return;
    }

    const loadAndSaveLayouts = async () => {
      try {
        const currentLayouts = await layoutManager.getLayouts();
        const currentLayoutsFroms = new Set(currentLayouts.map((layout) => layout.from));

        const loaderPromises = loaders.map(async (loader) => await loader.fetchLayouts());
        const loaderResults = await Promise.allSettled(loaderPromises);

        const newLayouts = loaderResults
          .filter(isFulfilled)
          .flatMap((result) => result.value)
          .filter((layout) => !currentLayoutsFroms.has(layout.from));

        // Log errors cause failed to fetch some layout from a specific loader
        loaderResults.filter(isRejected).forEach((result) => {
          log.error(`Failed to fetch layouts from loader: ${result.reason}`);
        });

        const savedPromises = newLayouts.map(
          async (layout) =>
            await layoutManager.saveNewLayout({
              ...layout,
              permission: "CREATOR_WRITE",
            }),
        );

        // Try to save all layouts
        const saveResults = await Promise.allSettled(savedPromises);

        // Log errors cause failed to save a layout
        saveResults.filter(isRejected).forEach((result) => {
          log.error(`Failed to save layout: ${result.reason}`);
        });
      } catch (err) {
        log.error(`Loading default layouts failed: ${err}`);
      }
    };
    void loadAndSaveLayouts();
  }, [layoutManager, loaders]);

  // Sync periodically when logged in, online, and the app is not hidden
  const enableSyncing = remoteLayoutStorage != undefined && online && visibilityState === "visible";
  useEffect(() => {
    if (!enableSyncing) {
      return;
    }
    const controller = new AbortController();
    void (async () => {
      let failures = 0;
      while (!controller.signal.aborted) {
        try {
          await layoutManager.syncWithRemote(controller.signal);
          failures = 0;
        } catch (error) {
          log.error("Sync failed:", error);
          failures++;
        }
        // Exponential backoff with jitter:
        // https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
        const duration =
          Math.random() * Math.min(SYNC_INTERVAL_MAX_MS, SYNC_INTERVAL_BASE_MS * 2 ** failures);
        log.debug("Waiting", (duration / 1000).toFixed(2), "sec for next sync", { failures });
        await delay(duration);
      }
    })();
    return () => {
      log.debug("Canceling layout sync due to effect cleanup callback");
      controller.abort();
    };
  }, [enableSyncing, layoutManager]);

  return (
    <LayoutManagerContext.Provider value={layoutManager}>{children}</LayoutManagerContext.Provider>
  );
}
