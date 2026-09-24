// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback } from "react";

import { useShallowMemo } from "@lichtblick/hooks";
import { LOCAL_STORAGE_FAVORITE_LAYOUT_IDS } from "@lichtblick/suite-base/constants/browserStorageKeys";
import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { FavoriteLayoutsStorageContext } from "@lichtblick/suite-base/context/FavoriteLayoutsStorageContext";
import { useRemoteFavoriteLayoutsStorage } from "@lichtblick/suite-base/context/RemoteFavoriteLayoutsStorageContext";

function readLocalFavoriteLayoutIds(): LayoutID[] {
  const item = localStorage.getItem(LOCAL_STORAGE_FAVORITE_LAYOUT_IDS);
  return item != undefined ? (JSON.parse(item) as LayoutID[]) : [];
}

function writeLocalFavoriteLayoutIds(ids: LayoutID[]): void {
  localStorage.setItem(LOCAL_STORAGE_FAVORITE_LAYOUT_IDS, JSON.stringify(ids) ?? "");
}

/**
 * A provider for FavoriteLayoutsStorage, local-only by default. When a
 * RemoteFavoriteLayoutsStorageContext is supplied (i.e. deployed with a backend), add/remove call
 * the backend's atomic $addToSet/$pull endpoints directly instead of a read-merge-write of a
 * whole blob, so there's no staleness/lost-update window between devices.
 */
export default function FavoriteLayoutsLocalStorageProvider({
  children,
}: Readonly<React.PropsWithChildren>): React.JSX.Element {
  const remote = useRemoteFavoriteLayoutsStorage();

  const getFavoriteLayoutIds = useCallback(async (): Promise<LayoutID[]> => {
    if (!remote) {
      return readLocalFavoriteLayoutIds();
    }
    try {
      const ids = await remote.getFavoriteLayoutIds();
      writeLocalFavoriteLayoutIds(ids);
      return ids;
    } catch (err: unknown) {
      console.error(err);
      return readLocalFavoriteLayoutIds();
    }
  }, [remote]);

  const toggleFavoriteLayout = useCallback(
    async (id: LayoutID): Promise<void> => {
      const current = await getFavoriteLayoutIds();
      const isFavorite = current.includes(id);
      const next = isFavorite ? current.filter((existing) => existing !== id) : [...current, id];
      writeLocalFavoriteLayoutIds(next);

      if (remote) {
        try {
          if (isFavorite) {
            await remote.removeFavoriteLayout(id);
          } else {
            await remote.addFavoriteLayout(id);
          }
        } catch (err: unknown) {
          console.error(err);
        }
      }
    },
    [remote, getFavoriteLayoutIds],
  );

  const storage = useShallowMemo({ getFavoriteLayoutIds, toggleFavoriteLayout });

  return (
    <FavoriteLayoutsStorageContext.Provider value={storage}>
      {children}
    </FavoriteLayoutsStorageContext.Provider>
  );
}
