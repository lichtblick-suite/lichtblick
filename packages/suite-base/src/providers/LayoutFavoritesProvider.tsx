// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";

import Logger from "@lichtblick/log";
import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import {
  LayoutFavorites,
  LayoutFavoritesContext,
} from "@lichtblick/suite-base/context/LayoutFavoritesContext";
import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import { useRemoteLayoutFavoritesStorage } from "@lichtblick/suite-base/context/RemoteLayoutFavoritesStorageContext";
import { useUserProfileStorage } from "@lichtblick/suite-base/context/UserProfileStorageContext";
import { Layout, layoutIsShared } from "@lichtblick/suite-base/services/ILayoutStorage";

const log = Logger.getLogger(__filename);

function updateIds(
  ids: ReadonlySet<string>,
  id: string,
  { included }: { included: boolean },
): ReadonlySet<string> {
  if (ids.has(id) === included) {
    return ids;
  }
  const next = new Set(ids);
  if (included) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
}

/**
 * Provides the current user's favorite layouts.
 *
 * - Personal layouts only exist locally, so their favorites are kept in the local user profile,
 *   keyed by `Layout.id`.
 * - Shared layouts are favorited through the remote favorites storage (when available), keyed by
 *   `Layout.externalId`. Remote favorites are (re)loaded whenever the layout manager goes online.
 *
 * Changes are applied optimistically and rolled back if persisting them fails. Remote writes for
 * the same layout are sent one after the other, so they reach the server in the order they were
 * made.
 */
export default function LayoutFavoritesProvider({
  children,
}: Readonly<PropsWithChildren>): React.JSX.Element {
  const remote = useRemoteLayoutFavoritesStorage();
  const { getUserProfile, setUserProfile } = useUserProfileStorage();
  const layoutManager = useLayoutManager();

  const [localIds, setLocalIds] = useState<ReadonlySet<string>>(() => new Set());
  const [remoteIds, setRemoteIds] = useState<ReadonlySet<string>>(() => new Set());

  // Kept in sync with the state above without waiting for a render, so consecutive changes read
  // the latest favorites.
  const localIdsRef = useRef<ReadonlySet<string>>(localIds);
  const remoteIdsRef = useRef<ReadonlySet<string>>(remoteIds);

  // Remote favorites as last loaded from or written to the server. Failed writes roll back to it.
  const savedRemoteIds = useRef<ReadonlySet<string>>(new Set<string>());

  // The last remote write per external id. Each write waits for the previous one of its layout.
  const remoteWrites = useRef(new Map<string, Promise<void>>());

  // Incremented on every change. A load that started before a change is stale and must not
  // overwrite it.
  const localVersion = useRef(0);
  const remoteVersion = useRef(0);

  const updateLocalIds = useCallback(
    (update: (ids: ReadonlySet<string>) => ReadonlySet<string>) => {
      localIdsRef.current = update(localIdsRef.current);
      setLocalIds(localIdsRef.current);
    },
    [],
  );

  const updateRemoteIds = useCallback(
    (update: (ids: ReadonlySet<string>) => ReadonlySet<string>) => {
      remoteIdsRef.current = update(remoteIdsRef.current);
      setRemoteIds(remoteIdsRef.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const version = localVersion.current;
    getUserProfile()
      .then((profile) => {
        if (!cancelled && version === localVersion.current) {
          updateLocalIds(() => new Set(profile.favoriteLayoutIds ?? []));
        }
      })
      .catch((error: unknown) => {
        log.error("Failed to load local favorite layouts", error);
      });
    return () => {
      cancelled = true;
    };
  }, [getUserProfile, updateLocalIds]);

  useEffect(() => {
    if (!remote) {
      return;
    }
    let cancelled = false;
    const load = () => {
      if (!layoutManager.isOnline) {
        return;
      }
      const version = remoteVersion.current;
      remote
        .getFavoriteLayoutIds()
        .then((ids) => {
          if (!cancelled && version === remoteVersion.current) {
            const loaded = new Set(ids);
            savedRemoteIds.current = loaded;
            updateRemoteIds((current) => {
              const next = new Set(loaded);
              for (const externalId of remoteWrites.current.keys()) {
                if (current.has(externalId)) {
                  next.add(externalId);
                } else {
                  next.delete(externalId);
                }
              }
              return next;
            });
          }
        })
        .catch((error: unknown) => {
          log.error("Failed to load remote favorite layouts", error);
        });
    };
    load();
    layoutManager.on("onlinechange", load);
    return () => {
      cancelled = true;
      layoutManager.off("onlinechange", load);
    };
  }, [layoutManager, remote, updateRemoteIds]);

  const canFavorite = useCallback(
    (layout: Layout) =>
      !layoutIsShared(layout) || (remote != undefined && layout.externalId != undefined),
    [remote],
  );

  const isFavorite = useCallback(
    (layout: Layout) =>
      layoutIsShared(layout)
        ? layout.externalId != undefined && remoteIds.has(layout.externalId)
        : localIds.has(layout.id),
    [localIds, remoteIds],
  );

  const setFavorite = useCallback(
    async (layout: Layout, { favorite }: { favorite: boolean }) => {
      if (layoutIsShared(layout)) {
        const { externalId } = layout;
        if (!remote || externalId == undefined) {
          throw new Error(`Layout "${layout.name}" cannot be marked as favorite`);
        }
        remoteVersion.current++;
        updateRemoteIds((ids) => updateIds(ids, externalId, { included: favorite }));

        const write = (remoteWrites.current.get(externalId) ?? Promise.resolve()).then(async () => {
          if (favorite) {
            await remote.addFavoriteLayout(externalId);
          } else {
            await remote.removeFavoriteLayout(externalId);
          }
          savedRemoteIds.current = updateIds(savedRemoteIds.current, externalId, {
            included: favorite,
          });
        });
        // The next write of this layout runs after this one, whether it succeeds or fails.
        const settled = write.catch(() => {});
        remoteWrites.current.set(externalId, settled);
        try {
          await write;
        } catch (error) {
          // A newer write of this layout is pending and will settle its state.
          if (remoteWrites.current.get(externalId) === settled) {
            updateRemoteIds((ids) =>
              updateIds(ids, externalId, {
                included: savedRemoteIds.current.has(externalId),
              }),
            );
          }
          throw error;
        } finally {
          if (remoteWrites.current.get(externalId) === settled) {
            remoteWrites.current.delete(externalId);
          }
        }
        return;
      }

      const wasFavorite = localIdsRef.current.has(layout.id);
      const version = ++localVersion.current;
      updateLocalIds((ids) => updateIds(ids, layout.id, { included: favorite }));
      try {
        await setUserProfile((profile) => ({
          ...profile,
          favoriteLayoutIds: [
            ...updateIds(new Set(profile.favoriteLayoutIds ?? []), layout.id, {
              included: favorite,
            }),
          ] as LayoutID[],
        }));
      } catch (error) {
        if (version === localVersion.current) {
          updateLocalIds((ids) => updateIds(ids, layout.id, { included: wasFavorite }));
        }
        throw error;
      }
    },
    [remote, setUserProfile, updateLocalIds, updateRemoteIds],
  );

  const value = useMemo<LayoutFavorites>(
    () => ({ canFavorite, isFavorite, setFavorite }),
    [canFavorite, isFavorite, setFavorite],
  );

  return (
    <LayoutFavoritesContext.Provider value={value}>{children}</LayoutFavoritesContext.Provider>
  );
}
