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
 * Changes are applied optimistically and rolled back if persisting them fails.
 */
export default function LayoutFavoritesProvider({
  children,
}: PropsWithChildren): React.JSX.Element {
  const remote = useRemoteLayoutFavoritesStorage();
  const { getUserProfile, setUserProfile } = useUserProfileStorage();
  const layoutManager = useLayoutManager();

  const [localIds, setLocalIds] = useState<ReadonlySet<string>>(() => new Set());
  const [remoteIds, setRemoteIds] = useState<ReadonlySet<string>>(() => new Set());

  // Incremented on every local change. A load that started before a change is stale and must not
  // overwrite it.
  const localVersion = useRef(0);
  const remoteVersion = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const version = localVersion.current;
    getUserProfile()
      .then((profile) => {
        if (!cancelled && version === localVersion.current) {
          setLocalIds(new Set(profile.favoriteLayoutIds ?? []));
        }
      })
      .catch((error: unknown) => {
        log.error("Failed to load local favorite layouts", error);
      });
    return () => {
      cancelled = true;
    };
  }, [getUserProfile]);

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
            setRemoteIds(new Set(ids));
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
  }, [layoutManager, remote]);

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
        const wasFavorite = remoteIds.has(externalId);
        remoteVersion.current++;
        setRemoteIds((ids) => updateIds(ids, externalId, { included: favorite }));
        try {
          if (favorite) {
            await remote.addFavoriteLayout(externalId);
          } else {
            await remote.removeFavoriteLayout(externalId);
          }
        } catch (error) {
          setRemoteIds((ids) => updateIds(ids, externalId, { included: wasFavorite }));
          throw error;
        }
        return;
      }

      const wasFavorite = localIds.has(layout.id);
      localVersion.current++;
      setLocalIds((ids) => updateIds(ids, layout.id, { included: favorite }));
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
        setLocalIds((ids) => updateIds(ids, layout.id, { included: wasFavorite }));
        throw error;
      }
    },
    [localIds, remote, remoteIds, setUserProfile],
  );

  const value = useMemo<LayoutFavorites>(
    () => ({ canFavorite, isFavorite, setFavorite }),
    [canFavorite, isFavorite, setFavorite],
  );

  return (
    <LayoutFavoritesContext.Provider value={value}>{children}</LayoutFavoritesContext.Provider>
  );
}
