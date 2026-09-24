// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { createContext, useContext } from "react";

import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";

/**
 * The current user's favorite layouts.
 *
 * Personal layouts are favorited locally; shared layouts are favorited through remote storage, so
 * the favorite state belongs to the user and is not shared with the layout's workspace.
 */
export type LayoutFavorites = {
  /** Whether the favorite state of this layout can be changed. */
  canFavorite: (layout: Layout) => boolean;
  isFavorite: (layout: Layout) => boolean;
  setFavorite: (layout: Layout, state: { favorite: boolean }) => Promise<void>;
};

const NO_FAVORITES: LayoutFavorites = {
  canFavorite: () => false,
  isFavorite: () => false,
  setFavorite: async () => {
    throw new Error("A LayoutFavorites provider is required to change favorite layouts");
  },
};

export const LayoutFavoritesContext = createContext<LayoutFavorites>(NO_FAVORITES);
LayoutFavoritesContext.displayName = "LayoutFavoritesContext";

/** Without a provider, favorites are disabled: no layout is a favorite and none can be changed. */
export function useLayoutFavorites(): LayoutFavorites {
  return useContext(LayoutFavoritesContext);
}
