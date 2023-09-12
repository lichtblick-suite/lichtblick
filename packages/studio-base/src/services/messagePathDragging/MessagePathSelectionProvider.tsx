// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useMemo } from "react";
import { useLatest } from "react-use";

import { filterMap } from "@foxglove/den/collection";
import { DraggedMessagePath } from "@foxglove/studio";

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
    selectedIndexes: ReadonlySet<number>;
    getItemAtIndex: (index: number) => DraggedMessagePath | undefined;
  }>,
): JSX.Element {
  const latestProps = useLatest(props);

  const value = useMemo(
    () => ({
      getSelectedItems() {
        return filterMap(
          Array.from(latestProps.current.selectedIndexes).sort(),
          latestProps.current.getItemAtIndex,
        );
      },
    }),
    [latestProps],
  );

  return (
    <MessagePathSelectionContextInternal.Provider value={value}>
      {props.children}
    </MessagePathSelectionContextInternal.Provider>
  );
}
