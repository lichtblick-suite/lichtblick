// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect } from "react";
import useAsyncFn from "react-use/lib/useAsyncFn";

import Logger from "@lichtblick/log";
import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useFavoriteLayoutsStorage } from "@lichtblick/suite-base/context/FavoriteLayoutsStorageContext";

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
  const { getFavoriteLayoutIds, toggleFavoriteLayout: toggle } = useFavoriteLayoutsStorage();

  const [{ value: favoriteLayoutIds = [], loading }, reload] = useAsyncFn(
    getFavoriteLayoutIds,
    [getFavoriteLayoutIds],
    { loading: true },
  );

  useEffect(() => {
    reload().catch((err: unknown) => {
      log.error(err);
    });
  }, [reload]);

  const toggleFavoriteLayout = useCallback(
    async (id: LayoutID) => {
      await toggle(id);
      await reload();
    },
    [reload, toggle],
  );

  return { favoriteLayoutIds, loading, toggleFavoriteLayout };
}
