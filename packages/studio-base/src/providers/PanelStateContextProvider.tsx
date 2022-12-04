// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { pick, uniq } from "lodash";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { createSelector, createSelectorCreator, defaultMemoize } from "reselect";
import { DeepReadonly } from "ts-essentials";
import { createStore, StoreApi } from "zustand";

import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import {
  LayoutState,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import {
  ImmutableSettingsTree,
  PanelStateContext,
  PanelStateStore,
  SharedPanelState,
  usePanelStateStore,
} from "@foxglove/studio-base/context/PanelStateContext";
import { getPanelTypeFromId } from "@foxglove/studio-base/util/layout";

function createPanelStateStore(): StoreApi<PanelStateStore> {
  return createStore((set) => {
    return {
      sequenceNumbers: {},
      settingsTrees: {},
      sharedPanelState: {},

      incrementSequenceNumber: (panelId: string) => {
        set((state) => {
          return {
            sequenceNumbers: {
              ...state.sequenceNumbers,
              [panelId]: (state.sequenceNumbers[panelId] ?? 0) + 1,
            },
          };
        });
      },

      updateSettingsTree: (panelId, settingsTree) => {
        set((state) => ({
          settingsTrees: {
            ...state.settingsTrees,
            [panelId]: settingsTree,
          },
        }));
      },

      updateSharedPanelState: (type: string, data: SharedPanelState) => {
        set((old) => ({ sharedPanelState: { ...old.sharedPanelState, [type]: data } }));
      },
    };
  });
}

const updateSettingsTreeSelector = (store: PanelStateStore) => store.updateSettingsTree;

/**
 * Returns updater function for the current panels settings tree.
 */
export function usePanelSettingsTreeUpdate(): (newTree: ImmutableSettingsTree) => void {
  const { id } = usePanelContext();
  const updateStoreTree = usePanelStateStore(updateSettingsTreeSelector);

  const updateSettingsTree = useCallback(
    (newTree: ImmutableSettingsTree) => {
      updateStoreTree(id, newTree);
    },
    [id, updateStoreTree],
  );

  return updateSettingsTree;
}

const updateSharedDataSelector = (store: PanelStateStore) => store.updateSharedPanelState;

/**
 * Returns a [state, setState] pair that can be used to read and update shared transient
 * panel state.
 */
export function useSharedPanelState(): [
  DeepReadonly<SharedPanelState>,
  (data: DeepReadonly<SharedPanelState>) => void,
] {
  const panelId = usePanelContext().id;
  const panelType = useMemo(() => getPanelTypeFromId(panelId), [panelId]);

  const selector = useCallback(
    (store: PanelStateStore) => {
      return store.sharedPanelState[panelType];
    },
    [panelType],
  );

  const updateSharedData = usePanelStateStore(updateSharedDataSelector);
  const sharedData = usePanelStateStore(selector);
  const update = useCallback(
    (data: DeepReadonly<SharedPanelState>) => {
      updateSharedData(panelType, data);
    },
    [panelType, updateSharedData],
  );

  return [sharedData, update];
}

/**
 * True if both objects have the same keys, ignoring values.
 */
function hasSameKeys(
  a: undefined | Record<string, unknown>,
  b: undefined | Record<string, unknown>,
) {
  if (a === b) {
    return true;
  }

  if (a == undefined && b != undefined) {
    return false;
  }
  if (a != undefined && b == undefined) {
    return false;
  }

  if (a != undefined && b != undefined) {
    for (const keyA in a) {
      if (!Object.prototype.hasOwnProperty.call(b, keyA)) {
        return false;
      }
    }

    for (const keyB in b) {
      if (!Object.prototype.hasOwnProperty.call(a, keyB)) {
        return false;
      }
    }
  }

  return true;
}

const createHasSameKeySelector = createSelectorCreator(defaultMemoize, hasSameKeys);

const selectCurrentLayoutId = (state: LayoutState) => state.selectedLayout?.id;

const selectLayoutConfigById = createHasSameKeySelector(
  (state: LayoutState) => state.selectedLayout?.data?.configById,
  (config) => config,
);

const selectPanelTypesInUse = createSelector(selectLayoutConfigById, (config) => {
  return uniq(Object.keys(config ?? {}).map(getPanelTypeFromId));
});

export function PanelStateContextProvider({ children }: { children?: ReactNode }): JSX.Element {
  const [store] = useState(createPanelStateStore());

  // discared shared panel state for panel types that are no longer in the layout
  const panelTypesInUse = useCurrentLayoutSelector(selectPanelTypesInUse);
  useEffect(() => {
    store.setState((old) => ({ sharedPanelState: pick(old.sharedPanelState, panelTypesInUse) }));
  }, [panelTypesInUse, store]);

  // clear shared panel state on layout change
  const currentLayoutId = useCurrentLayoutSelector(selectCurrentLayoutId);
  useEffect(() => {
    void currentLayoutId;
    store.setState({ sharedPanelState: {} });
  }, [currentLayoutId, store]);

  return <PanelStateContext.Provider value={store}>{children}</PanelStateContext.Provider>;
}
