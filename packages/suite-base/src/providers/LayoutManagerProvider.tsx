// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useMemo } from "react";
import { useNetworkState } from "react-use";

import { useVisibilityState } from "@lichtblick/hooks";
import Logger from "@lichtblick/log";
import LayoutManagerContext from "@lichtblick/suite-base/context/LayoutManagerContext";
import { useLayoutStorage } from "@lichtblick/suite-base/context/LayoutStorageContext";
import { useRemoteLayoutStorage } from "@lichtblick/suite-base/context/RemoteLayoutStorageContext";
import LayoutManager from "@lichtblick/suite-base/services/LayoutManager/LayoutManager";
import delay from "@lichtblick/suite-base/util/delay";

const log = Logger.getLogger(__filename);

const SYNC_INTERVAL_BASE_MS = 30_000;
const SYNC_INTERVAL_MAX_MS = 3 * 60_000;

export default function LayoutManagerProvider({
  children,
}: React.PropsWithChildren): React.JSX.Element {
  const layoutStorage = useLayoutStorage();
  const remoteLayoutStorage = useRemoteLayoutStorage();

  const layoutManager = useMemo(
    () => new LayoutManager({ local: layoutStorage, remote: remoteLayoutStorage }),
    [layoutStorage, remoteLayoutStorage],
  );

  const { online = false } = useNetworkState();
  const visibilityState = useVisibilityState();
  useEffect(() => {
    layoutManager.setOnline({ online });
  }, [layoutManager, online]);

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
