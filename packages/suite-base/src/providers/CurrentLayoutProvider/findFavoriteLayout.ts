// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Layout, layoutIsShared } from "@lichtblick/suite-base/services/ILayoutStorage";

type FavoriteLayoutIds = {
  /** Favorite personal layouts, identified by `Layout.id`. */
  personal: ReadonlySet<string>;
  /** Favorite shared layouts, identified by `Layout.externalId`. */
  shared: ReadonlySet<string>;
};

function firstByName(layouts: readonly Layout[]): Layout | undefined {
  return [...layouts].sort((a, b) => a.name.localeCompare(b.name))[0];
}

/**
 * Returns the favorite layout to select when the app opens.
 *
 * Favorite shared layouts take precedence over favorite personal layouts. When several favorites
 * qualify, the first one in the layout browser's order (alphabetical by name) is returned.
 */
export function findFavoriteLayout(
  layouts: readonly Layout[],
  favoriteIds: FavoriteLayoutIds,
): Layout | undefined {
  const shared = layouts.filter(
    (layout) =>
      layoutIsShared(layout) &&
      layout.externalId != undefined &&
      favoriteIds.shared.has(layout.externalId),
  );
  const personal = layouts.filter(
    (layout) => !layoutIsShared(layout) && favoriteIds.personal.has(layout.id),
  );
  return firstByName(shared) ?? firstByName(personal);
}
