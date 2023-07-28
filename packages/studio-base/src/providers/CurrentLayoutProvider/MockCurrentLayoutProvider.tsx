// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useMemo, useRef, useState } from "react";

import { useShallowMemo } from "@foxglove/hooks";
import CurrentLayoutContext, {
  ICurrentLayout,
  LayoutID,
  LayoutState,
  SelectedLayout,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import {
  PanelsActions,
  LayoutData,
} from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";

import panelsReducer from "./reducers";

/**
 * An alternative implementation of CurrentLayoutProvider, for use in tests, which performs actions
 * synchronously and doesn't require a LayoutManager.
 */
export default function MockCurrentLayoutProvider({
  children,
  initialState,
  onAction,
}: React.PropsWithChildren<{
  initialState?: Partial<LayoutData>;
  onAction?: (action: PanelsActions) => void;
}>): JSX.Element {
  const layoutStateListeners = useRef(new Set<(_: LayoutState) => void>());
  const addLayoutStateListener = useCallback((listener: (_: LayoutState) => void) => {
    layoutStateListeners.current.add(listener);
  }, []);
  const removeLayoutStateListener = useCallback((listener: (_: LayoutState) => void) => {
    layoutStateListeners.current.delete(listener);
  }, []);

  const [layoutState, setLayoutStateInternal] = useState<LayoutState>({
    selectedLayout: {
      id: "mock-layout" as LayoutID,
      data: {
        configById: {},
        globalVariables: {},
        userNodes: {},
        playbackConfig: defaultPlaybackConfig,
        ...initialState,
      },
    },
  });
  const layoutStateRef = useRef(layoutState);
  const setLayoutState = useCallback((newState: LayoutState) => {
    setLayoutStateInternal(newState);

    // listeners rely on being able to getCurrentLayoutState() inside effects that may run before we re-render
    layoutStateRef.current = newState;

    for (const listener of [...layoutStateListeners.current]) {
      listener(newState);
    }
  }, []);

  const setCurrentLayout = useCallback(
    (newLayout: SelectedLayout) => {
      setLayoutState({
        selectedLayout: newLayout,
      });
    },
    [setLayoutState],
  );

  const updateSharedPanelState = useCallback<ICurrentLayout["actions"]["updateSharedPanelState"]>(
    (type, newSharedState) => {
      setLayoutState({
        ...layoutStateRef.current,
        sharedPanelState: { ...layoutStateRef.current.sharedPanelState, [type]: newSharedState },
      });
    },
    [setLayoutState],
  );

  const performAction = useCallback(
    (action: PanelsActions) => {
      onAction?.(action);
      setLayoutState({
        ...layoutStateRef.current,
        selectedLayout: {
          id: "mock-layout" as LayoutID,
          ...layoutStateRef.current.selectedLayout,
          data: layoutStateRef.current.selectedLayout?.data
            ? panelsReducer(layoutStateRef.current.selectedLayout.data, action)
            : undefined,
        },
      });
    },
    [onAction, setLayoutState],
  );

  const actions: ICurrentLayout["actions"] = useMemo(
    () => ({
      getCurrentLayoutState: () => layoutStateRef.current,

      setCurrentLayout,
      updateSharedPanelState,

      savePanelConfigs: (payload) => performAction({ type: "SAVE_PANEL_CONFIGS", payload }),
      updatePanelConfigs: (panelType, perPanelFunc) =>
        performAction({ type: "SAVE_FULL_PANEL_CONFIG", payload: { panelType, perPanelFunc } }),
      createTabPanel: (payload) => performAction({ type: "CREATE_TAB_PANEL", payload }),
      changePanelLayout: (payload) => performAction({ type: "CHANGE_PANEL_LAYOUT", payload }),
      overwriteGlobalVariables: (payload) =>
        performAction({ type: "OVERWRITE_GLOBAL_DATA", payload }),
      setGlobalVariables: (payload) => performAction({ type: "SET_GLOBAL_DATA", payload }),
      setUserNodes: (payload) => performAction({ type: "SET_USER_NODES", payload }),
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
    [performAction, setCurrentLayout, updateSharedPanelState],
  );

  const value: ICurrentLayout = useShallowMemo({
    addLayoutStateListener,
    removeLayoutStateListener,
    addSelectedPanelIdsListener: useCallback(() => {}, []),
    removeSelectedPanelIdsListener: useCallback(() => {}, []),
    mosaicId: "mockMosaicId",
    getSelectedPanelIds: useCallback(() => [], []),
    setSelectedPanelIds: useCallback(() => {
      // no-op
    }, []),
    actions,
  });
  return <CurrentLayoutContext.Provider value={value}>{children}</CurrentLayoutContext.Provider>;
}
