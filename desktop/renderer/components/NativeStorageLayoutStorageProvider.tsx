// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";

import LayoutStorageContext from "@foxglove-studio/app/context/LayoutStorageContext";

import { useNativeStorage } from "../context/NativeStorageContext";
import NativeStorageLayoutStorage from "../services/NativeStorageLayoutStorage";

// Provide an instance of the OsContextLayoutStorage
export default function NativeStorageLayoutStorageProvider(
  props: PropsWithChildren<unknown>,
): JSX.Element {
  const storage = useNativeStorage();

  const provider = useMemo(() => {
    return new NativeStorageLayoutStorage(storage);
  }, [storage]);

  return (
    <LayoutStorageContext.Provider value={provider}>{props.children}</LayoutStorageContext.Provider>
  );
}
