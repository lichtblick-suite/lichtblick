// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReactElement, useEffect } from "react";

import OsContextSingleton from "@foxglove-studio/app/OsContextSingleton";
import { usePlayerSelection } from "@foxglove-studio/app/context/PlayerSelectionContext";

// NativeFileMenuPlayerSelection adds available player selection items to the apps native OS menubar
export function NativeFileMenuPlayerSelection(): ReactElement {
  const { selectSource, availableSources } = usePlayerSelection();

  useEffect(() => {
    for (const item of availableSources) {
      OsContextSingleton?.menuAddInputSource(item.name, () => {
        selectSource(item);
      });
    }

    return () => {
      for (const item of availableSources) {
        OsContextSingleton?.menuRemoveInputSource(item.name);
      }
    };
  }, [availableSources, selectSource]);

  return <></>;
}
