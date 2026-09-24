// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { LayoutID } from "@lichtblick/suite-base/context/CurrentLayoutContext";

export type FavoriteLayoutsStorage = {
  getFavoriteLayoutIds: () => Promise<LayoutID[]>;
  toggleFavoriteLayout: (id: LayoutID) => Promise<void>;
};

export const FavoriteLayoutsStorageContext = createContext<FavoriteLayoutsStorage | undefined>(
  undefined,
);
FavoriteLayoutsStorageContext.displayName = "FavoriteLayoutsStorageContext";

export function useFavoriteLayoutsStorage(): FavoriteLayoutsStorage {
  const storage = useContext(FavoriteLayoutsStorageContext);
  if (storage == undefined) {
    throw new Error("A FavoriteLayoutsStorage provider is required to useFavoriteLayoutsStorage");
  }

  return storage;
}
