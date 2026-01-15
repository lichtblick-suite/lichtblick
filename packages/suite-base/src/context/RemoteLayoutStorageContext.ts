// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { IRemoteLayoutStorage } from "@lichtblick/suite-base/services/IRemoteLayoutStorage";

export const RemoteLayoutStorageContext = createContext<IRemoteLayoutStorage | undefined>(
  undefined,
);
RemoteLayoutStorageContext.displayName = "RemoteLayoutStorageContext";

export function useRemoteLayoutStorage(): IRemoteLayoutStorage | undefined {
  return useContext(RemoteLayoutStorageContext);
}
