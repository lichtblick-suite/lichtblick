// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReactElement, useEffect } from "react";

import { useNativeAppMenu } from "@foxglove/studio-base/context/NativeAppMenuContext";
import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";

// NativeFileMenuPlayerSelection adds available player selection items to the apps native OS menubar
export function NativeFileMenuPlayerSelection(): ReactElement {
  const { selectSource, availableSources } = usePlayerSelection();

  const nativeAppMenu = useNativeAppMenu();

  useEffect(() => {
    if (!nativeAppMenu) {
      return;
    }

    for (const item of availableSources) {
      nativeAppMenu.addFileEntry(item.displayName, () => {
        selectSource(item.id);
      });
    }

    return () => {
      for (const item of availableSources) {
        nativeAppMenu.removeFileEntry(item.displayName);
      }
    };
  }, [availableSources, nativeAppMenu, selectSource]);

  return <></>;
}
