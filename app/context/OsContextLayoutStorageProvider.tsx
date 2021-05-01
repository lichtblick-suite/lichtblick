// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useMemo } from "react";

import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import LayoutStorageContext from "@foxglove-studio/app/context/LayoutStorageContext";
import OsContextLayoutStorage from "@foxglove-studio/app/services/OsContextLayoutStorage";

// Provide an instance of the OsContextLayoutStorage
export default function OsContextLayoutStorageProvider(
  props: PropsWithChildren<unknown>,
): JSX.Element {
  const provider = useMemo(() => {
    if (!OsContextSingleton) {
      return undefined;
    }

    return new OsContextLayoutStorage(OsContextSingleton);
  }, []);

  return (
    <LayoutStorageContext.Provider value={provider}>{props.children}</LayoutStorageContext.Provider>
  );
}
