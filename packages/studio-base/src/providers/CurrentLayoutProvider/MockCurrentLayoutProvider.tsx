// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useMemo, useRef, useState } from "react";

import { useShallowMemo } from "@foxglove/hooks";
import CurrentLayoutContext, {
  ICurrentLayout,
  LayoutState,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import {
  PanelsActions,
  PanelsState,
} from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import { LayoutID } from "@foxglove/studio-base/services/ConsoleApi";

import panelsReducer from "./reducers";

// ts-prune-ignore-next
/**
 * An alternative implementation of CurrentLayoutProvider, for use in tests, which performs actions
 * synchronously and doesn't require a LayoutManager.
 */
export default function MockCurrentLayoutProvider({
  children,
  initialState,
}: React.PropsWithChildren<{ initialState?: Partial<PanelsState> }>): JSX.Element {
  const layoutStateListeners = useRef(new Set<(_: LayoutState) => void>());
  const addLayoutStateListener = useCallback((listener: (_: LayoutState) => void) => {
    layoutStateListeners.current.add(listener);
  }, []);
  const removeLayoutStateListener = useCallback((listener: (_: LayoutState) => void) => {
    layoutStateListeners.current.delete(listener);
  }, []);

  const [layoutState, setLayoutStateInternal] = useState({
    selectedLayout: {
      id: "mock-layout" as LayoutID,
      data: {
        configById: {},
        globalVariables: {},
        userNodes: {},
        linkedGlobalVariables: [],
        playbackConfig: defaultPlaybackConfig,
        ...initialState,
      },
    },
  });
  const layoutStateRef = useRef(layoutState);
  const setLayoutState = useCallback((newState: typeof layoutState) => {
    setLayoutStateInternal(newState);

    // listeners rely on being able to getCurrentLayoutState() inside effects that may run before we re-render
    layoutStateRef.current = newState;

    for (const listener of [...layoutStateListeners.current]) {
      listener(newState);
    }
  }, []);

  const performAction = useCallback(
    (action: PanelsActions) => {
      setLayoutState({
        ...layoutStateRef.current,
        selectedLayout: {
          ...layoutStateRef.current.selectedLayout,
          data: panelsReducer(layoutStateRef.current.selectedLayout.data, action),
        },
      });
    },
    [setLayoutState],
  );

  const actions: ICurrentLayout["actions"] = useMemo(
    () => ({
      setSelectedLayoutId: () => {
        throw new Error("Not implemented in MockCurrentLayoutProvider");
      },
      getCurrentLayoutState: () => layoutStateRef.current,

      savePanelConfigs: (payload) => performAction({ type: "SAVE_PANEL_CONFIGS", payload }),
      updatePanelConfigs: (panelType, perPanelFunc) =>
        performAction({ type: "SAVE_FULL_PANEL_CONFIG", payload: { panelType, perPanelFunc } }),
      createTabPanel: (payload) => performAction({ type: "CREATE_TAB_PANEL", payload }),
      changePanelLayout: (payload) => performAction({ type: "CHANGE_PANEL_LAYOUT", payload }),
      overwriteGlobalVariables: (payload) =>
        performAction({ type: "OVERWRITE_GLOBAL_DATA", payload }),
      setGlobalVariables: (payload) => performAction({ type: "SET_GLOBAL_DATA", payload }),
      setUserNodes: (payload) => performAction({ type: "SET_USER_NODES", payload }),
      setLinkedGlobalVariables: (payload) =>
        performAction({ type: "SET_LINKED_GLOBAL_VARIABLES", payload }),
      setPlaybackConfig: (payload) => performAction({ type: "SET_PLAYBACK_CONFIG", payload }),
      closePanel: (payload) => performAction({ type: "CLOSE_PANEL", payload }),
      splitPanel: (payload) => performAction({ type: "SPLIT_PANEL", payload }),
      swapPanel: (payload) => performAction({ type: "SWAP_PANEL", payload }),
      moveTab: (payload) => performAction({ type: "MOVE_TAB", payload }),
      addPanel: (payload) => performAction({ type: "ADD_PANEL", payload }),
      dropPanel: (payload) => performAction({ type: "DROP_PANEL", payload }),
      startDrag: (payload) => performAction({ type: "START_DRAG", payload }),
      endDrag: (payload) => performAction({ type: "END_DRAG", payload }),
    }),
    [performAction],
  );

  const value: ICurrentLayout = useShallowMemo({
    addLayoutStateListener,
    removeLayoutStateListener,
    addSelectedPanelIdsListener: useCallback(() => {}, []),
    removeSelectedPanelIdsListener: useCallback(() => {}, []),
    addPanelDocToDisplayListener: useCallback(() => {}, []),
    removePanelDocToDisplayListener: useCallback(() => {}, []),
    mosaicId: "mockMosaicId",
    getSelectedPanelIds: useCallback(() => [], []),
    setSelectedPanelIds: useCallback(() => {
      throw new Error("Not implemented in MockCurrentLayoutProvider");
    }, []),
    getPanelDocToDisplay: useCallback(() => "", []),
    setPanelDocToDisplay: useCallback(() => {
      throw new Error("Not implemented in MockCurrentLayoutProvider");
    }, []),
    actions,
  });
  return <CurrentLayoutContext.Provider value={value}>{children}</CurrentLayoutContext.Provider>;
}
