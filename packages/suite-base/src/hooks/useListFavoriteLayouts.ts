// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect } from "react";
import useAsyncFn from "react-use/lib/useAsyncFn";

import Logger from "@lichtblick/log";
import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useUserProfileStorage } from "@lichtblick/suite-base/context/UserProfileStorageContext";

const log = Logger.getLogger(__filename);

type UseListFavoriteLayouts = {
  favoriteLayoutIds: LayoutID[];
  loading: boolean;
  toggleFavoriteLayout: (id: LayoutID) => Promise<void>;
};

/**
 * Lists the current user's favourite layout ids.
 */
export function useListFavoriteLayouts(): UseListFavoriteLayouts {
  const { getUserProfile, setUserProfile } = useUserProfileStorage();

  const [{ value: favoriteLayoutIds = [], loading }, reload] = useAsyncFn(
    async () => {
      const profile = await getUserProfile();
      return profile.favoriteLayoutIds ?? [];
    },
    [getUserProfile],
    { loading: true },
  );

  useEffect(() => {
    reload().catch((err: unknown) => {
      log.error(err);
    });
  }, [reload]);

  const toggleFavoriteLayout = useCallback(
    async (id: LayoutID) => {
      await setUserProfile((profile) => {
        const existing = profile.favoriteLayoutIds ?? [];
        const nextFavoriteLayoutIds = existing.includes(id)
          ? existing.filter((favoriteId) => favoriteId !== id)
          : [...existing, id];
        return { ...profile, favoriteLayoutIds: nextFavoriteLayoutIds };
      });
      await reload();
    },
    [reload, setUserProfile],
  );

  return { favoriteLayoutIds, loading, toggleFavoriteLayout };
}
