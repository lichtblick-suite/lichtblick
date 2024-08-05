// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IRemoteLayoutStorage } from "@lichtblick/suite-base/services/IRemoteLayoutStorage";
import { createContext, useContext } from "react";

const RemoteLayoutStorageContext = createContext<IRemoteLayoutStorage | undefined>(undefined);
RemoteLayoutStorageContext.displayName = "RemoteLayoutStorageContext";

export function useRemoteLayoutStorage(): IRemoteLayoutStorage | undefined {
  return useContext(RemoteLayoutStorageContext);
}
