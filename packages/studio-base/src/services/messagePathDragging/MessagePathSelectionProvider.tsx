// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useMemo } from "react";

import { DraggedMessagePath } from "@foxglove/studio-base/components/PanelExtensionAdapter";

type MessagePathSelectionContext = {
  getSelectedItems: () => DraggedMessagePath[];
};

export const MessagePathSelectionContextInternal = createContext<
  MessagePathSelectionContext | undefined
>(undefined);

/**
 * Holds state to support dragging multiple message paths at once.
 */
export function MessagePathSelectionProvider(
  props: React.PropsWithChildren<{
    getSelectedItems: () => DraggedMessagePath[];
  }>,
): JSX.Element {
  const value = useMemo(
    () => ({ getSelectedItems: props.getSelectedItems }),
    [props.getSelectedItems],
  );

  return (
    <MessagePathSelectionContextInternal.Provider value={value}>
      {props.children}
    </MessagePathSelectionContextInternal.Provider>
  );
}
