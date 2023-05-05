// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { pick, uniq } from "lodash";
import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
import { createSelector, createSelectorCreator, defaultMemoize } from "reselect";
import { DeepReadonly } from "ts-essentials";
import { StoreApi, createStore } from "zustand";

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

function createPanelStateStore(initialState?: Partial<PanelStateStore>): StoreApi<PanelStateStore> {
  return createStore((set) => {
    return {
      sequenceNumbers: {},
      settingsTrees: {},
      sharedPanelState: {},
      defaultTitles: {},

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

      updateDefaultTitle: (panelId, defaultTitle) => {
        set((state) => ({ defaultTitles: { ...state.defaultTitles, [panelId]: defaultTitle } }));
      },

      updateSharedPanelState: (type: string, data: SharedPanelState) => {
        set((old) => ({ sharedPanelState: { ...old.sharedPanelState, [type]: data } }));
      },

      ...initialState,
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

  /** Cleanup unmounted panels
   * `actionHandler` can capture panel variables in closure context and keep them in memory
   * even after unmounting. To prevent this we set the panelSettingsTree entry to undefined,
   * allowing the actionHandler and its captured closure context from the unmounted panel to
   * be garbage collected.
   */
  useEffect(() => {
    return () => {
      updateStoreTree(id, undefined);
    };
  }, [id, updateStoreTree]);

  return updateSettingsTree;
}

const updateSharedDataSelector = (store: PanelStateStore) => store.updateSharedPanelState;
const updateDefaultTitleSelector = (store: PanelStateStore) => store.updateDefaultTitle;

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
 * Returns a [state, setState] pair that can be used to read and update a panel's default title.
 */
export function useDefaultPanelTitle(): [
  string | undefined,
  (defaultTitle: string | undefined) => void,
] {
  const panelId = usePanelContext().id;

  const selector = useCallback((store: PanelStateStore) => store.defaultTitles[panelId], [panelId]);

  const updateDefaultTitle = usePanelStateStore(updateDefaultTitleSelector);
  const defaultTitle = usePanelStateStore(selector);
  const update = useCallback(
    (newValue: string | undefined) => {
      updateDefaultTitle(panelId, newValue);
    },
    [panelId, updateDefaultTitle],
  );

  return [defaultTitle, update];
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

type Props = PropsWithChildren<{
  initialState?: Partial<PanelStateStore>;
}>;

export function PanelStateContextProvider(props: Props): JSX.Element {
  const { children, initialState } = props;

  const [store] = useState(() => createPanelStateStore(initialState));

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
