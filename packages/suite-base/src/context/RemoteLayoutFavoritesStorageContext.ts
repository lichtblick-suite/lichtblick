// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { createContext, useContext } from "react";

import { IRemoteLayoutFavoritesStorage } from "@lichtblick/suite-base/services/IRemoteLayoutFavoritesStorage";

export const RemoteLayoutFavoritesStorageContext = createContext<
  IRemoteLayoutFavoritesStorage | undefined
>(undefined);
RemoteLayoutFavoritesStorageContext.displayName = "RemoteLayoutFavoritesStorageContext";

export function useRemoteLayoutFavoritesStorage(): IRemoteLayoutFavoritesStorage | undefined {
  return useContext(RemoteLayoutFavoritesStorageContext);
}
