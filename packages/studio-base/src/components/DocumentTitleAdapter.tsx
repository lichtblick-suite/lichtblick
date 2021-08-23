// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect } from "react";

import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";

/**
 * DocumentTitleAdapter sets the document title based on the currently selected player
 */
export default function DocumentTitleAdapter(): JSX.Element {
  const { currentSourceName } = usePlayerSelection();

  useEffect(() => {
    if (!currentSourceName) {
      window.document.title = "Foxglove Studio";
      return;
    }
    window.document.title = `${currentSourceName} - Foxglove Studio`;
  }, [currentSourceName]);
  return <></>;
}
