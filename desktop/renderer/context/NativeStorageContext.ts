// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

import { Storage } from "../../common/types";

const NativeStorageContext = createContext<Storage | undefined>(
  (global as { storageBridge?: Storage }).storageBridge,
);

export function useNativeStorage(): Storage {
  const nativeStorage = useContext(NativeStorageContext);
  if (!nativeStorage) {
    throw new Error("NativeStorageContext.Provider is required to useNativeStorage");
  }

  return nativeStorage;
}

export default NativeStorageContext;
