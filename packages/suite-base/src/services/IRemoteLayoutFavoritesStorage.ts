// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Stores the current user's favorite remote layouts.
 *
 * Favorites belong to the user, not to the workspace: marking a shared layout as favorite does not
 * change it for other users who can access the same layout. Layouts are identified by their remote
 * id (`Layout.externalId`).
 */
export interface IRemoteLayoutFavoritesStorage {
  getFavoriteLayoutIds: () => Promise<readonly string[]>;

  /** Idempotent: adding a layout that is already a favorite is a no-op. */
  addFavoriteLayout: (externalId: string) => Promise<void>;

  /** Idempotent: removing a layout that is not a favorite is a no-op. */
  removeFavoriteLayout: (externalId: string) => Promise<void>;
}
