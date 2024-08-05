// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useLayoutEffect, useState } from "react";
import { createStore, useStore } from "zustand";

export type OnSelectPayload = {
  index: number;
  modKey: boolean;
  shiftKey: boolean;
};

type State = {
  selectedIndexes: Set<number>;
  lastSelectedIndex: number | undefined;
};

export function useMultiSelection<T>(source: readonly T[]): {
  selectedIndexes: Set<number>;
  onSelect: (props: OnSelectPayload) => void;
  getSelectedIndexes: () => Set<number>;
} {
  const [store] = useState(() =>
    createStore<State>(() => ({
      selectedIndexes: new Set<number>(),
      lastSelectedIndex: undefined,
    })),
  );

  useLayoutEffect(() => {
    // Clear selection when the source changes
    store.setState({ selectedIndexes: new Set(), lastSelectedIndex: undefined });
  }, [store, source]);

  const onSelect = useCallback(
    ({ index, modKey, shiftKey }: OnSelectPayload) => {
      const { lastSelectedIndex, selectedIndexes } = store.getState();
      let newSelectedIndexes: Set<number>;
      if (modKey) {
        newSelectedIndexes = new Set(selectedIndexes);
        if (newSelectedIndexes.has(index)) {
          newSelectedIndexes.delete(index);
        } else {
          newSelectedIndexes.add(index);
        }
      } else if (shiftKey && lastSelectedIndex != undefined) {
        newSelectedIndexes = new Set(selectedIndexes);
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        for (let i = start; i <= end; i++) {
          newSelectedIndexes.add(i);
        }
      } else {
        newSelectedIndexes = new Set([index]);
      }
      store.setState({ selectedIndexes: newSelectedIndexes, lastSelectedIndex: index });
    },
    [store],
  );

  const { selectedIndexes } = useStore(store);

  const getSelectedIndexes = useCallback(() => store.getState().selectedIndexes, [store]);

  return { selectedIndexes, onSelect, getSelectedIndexes };
}
