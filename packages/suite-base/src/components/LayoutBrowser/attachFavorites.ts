// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { Layout } from "@lichtblick/suite-base/services/ILayoutStorage";

import { LayoutListItem } from "./types";

export function attachFavorites(
  items: readonly Layout[] | undefined,
  favoriteLayoutIds: readonly LayoutID[],
): LayoutListItem[] | undefined {
  return items
    ?.map((layout) => ({ ...layout, favorite: favoriteLayoutIds.includes(layout.id) }))
    .sort((a, b) => {
      const favoriteDiff = Number(b.favorite) - Number(a.favorite);
      return favoriteDiff !== 0 ? favoriteDiff : a.name.localeCompare(b.name);
    });
}
