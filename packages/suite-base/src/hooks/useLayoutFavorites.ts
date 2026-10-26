// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { useCallback, useSyncExternalStore } from "react";

import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import { LayoutFavorites } from "@lichtblick/suite-base/services/ILayoutManager";

/** The current user's favorite layouts, re-rendering whenever they change. */
export function useLayoutFavorites(): LayoutFavorites {
  const layoutManager = useLayoutManager();
  const subscribe = useCallback(
    (onChange: () => void) => {
      layoutManager.on("favoriteschange", onChange);
      return () => {
        layoutManager.off("favoriteschange", onChange);
      };
    },
    [layoutManager],
  );

  const getSnapshot = useCallback(() => layoutManager.favorites, [layoutManager]);
  return useSyncExternalStore(subscribe, getSnapshot);
}
