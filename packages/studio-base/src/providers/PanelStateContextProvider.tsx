// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { PropsWithChildren, useCallback, useEffect, useState } from "react";
import { StoreApi, createStore } from "zustand";

import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import {
  ImmutableSettingsTree,
  PanelStateContext,
  PanelStateStore,
  usePanelStateStore,
} from "@foxglove/studio-base/context/PanelStateContext";

function createPanelStateStore(initialState?: Partial<PanelStateStore>): StoreApi<PanelStateStore> {
  return createStore((set) => {
    return {
      sequenceNumbers: {},
      settingsTrees: {},
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

const updateDefaultTitleSelector = (store: PanelStateStore) => store.updateDefaultTitle;

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

type Props = PropsWithChildren<{
  initialState?: Partial<PanelStateStore>;
}>;

export function PanelStateContextProvider(props: Props): JSX.Element {
  const { children, initialState } = props;

  const [store] = useState(() => createPanelStateStore(initialState));

  return <PanelStateContext.Provider value={store}>{children}</PanelStateContext.Provider>;
}
