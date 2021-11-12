// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useCallback, useLayoutEffect, useReducer, useRef, useState } from "react";
import { getLeaves } from "react-mosaic-component";

import { useShallowMemo } from "@foxglove/hooks";
import { selectWithUnstableIdentityWarning } from "@foxglove/studio-base/hooks/selectWithUnstableIdentityWarning";
import useGuaranteedContext from "@foxglove/studio-base/hooks/useGuaranteedContext";
import { LinkedGlobalVariables } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import toggleSelectedPanel from "@foxglove/studio-base/providers/CurrentLayoutProvider/toggleSelectedPanel";
import { LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";
import { PanelConfig, PlaybackConfig, UserNodes } from "@foxglove/studio-base/types/panels";

import {
  PanelsState,
  AddPanelPayload,
  ChangePanelLayoutPayload,
  ClosePanelPayload,
  CreateTabPanelPayload,
  DropPanelPayload,
  EndDragPayload,
  MoveTabPayload,
  SaveConfigsPayload,
  SplitPanelPayload,
  StartDragPayload,
  SwapPanelPayload,
} from "./actions";

export type LayoutState = Readonly<{
  selectedLayout:
    | {
        id: LayoutID;
        loading?: boolean;
        data: PanelsState | undefined;
      }
    | undefined;
}>;

/**
 * Encapsulates the mosaic layout, user nodes, and playback settings (everything considered to be
 * part of a saved "layout") used by the current workspace.
 */
export interface ICurrentLayout {
  addLayoutStateListener: (listener: (_: LayoutState) => void) => void;
  removeLayoutStateListener: (listener: (_: LayoutState) => void) => void;
  addSelectedPanelIdsListener: (listener: (_: readonly string[]) => void) => void;
  removeSelectedPanelIdsListener: (listener: (_: readonly string[]) => void) => void;
  addPanelDocToDisplayListener: (listener: (_: string) => void) => void;
  removePanelDocToDisplayListener: (listener: (_: string) => void) => void;

  /**
   * We use the same mosaicId for all mosaics (at the top level and within tabs) to support
   * dragging and dropping between them.
   */
  mosaicId: string;

  getSelectedPanelIds: () => readonly string[];
  setSelectedPanelIds: (
    _: readonly string[] | ((prevState: readonly string[]) => readonly string[]),
  ) => void;
  setPanelDocToDisplay: (panelType: string) => void;
  getPanelDocToDisplay: () => string;

  actions: {
    /**
     * Returns the current state - useful for click handlers and callbacks that read the state
     * asynchronously and don't want to update every time the state changes.
     */
    getCurrentLayoutState: () => LayoutState;

    setSelectedLayoutId: (id: LayoutID | undefined) => void;

    savePanelConfigs: (payload: SaveConfigsPayload) => void;
    updatePanelConfigs: (panelType: string, updater: (config: PanelConfig) => PanelConfig) => void;
    createTabPanel: (payload: CreateTabPanelPayload) => void;
    changePanelLayout: (payload: ChangePanelLayoutPayload) => void;
    overwriteGlobalVariables: (payload: { [key: string]: unknown }) => void;
    setGlobalVariables: (payload: { [key: string]: unknown }) => void;
    setUserNodes: (payload: Partial<UserNodes>) => void;
    setLinkedGlobalVariables: (payload: LinkedGlobalVariables) => void;
    setPlaybackConfig: (payload: Partial<PlaybackConfig>) => void;
    closePanel: (payload: ClosePanelPayload) => void;
    splitPanel: (payload: SplitPanelPayload) => void;
    swapPanel: (payload: SwapPanelPayload) => void;
    moveTab: (payload: MoveTabPayload) => void;
    addPanel: (payload: AddPanelPayload) => void;
    dropPanel: (payload: DropPanelPayload) => void;
    startDrag: (payload: StartDragPayload) => void;
    endDrag: (payload: EndDragPayload) => void;
  };
}

export type CurrentLayoutActions = ICurrentLayout["actions"];

export type SelectedPanelActions = {
  getSelectedPanelIds: () => readonly string[];
  selectedPanelIds: readonly string[];
  setSelectedPanelIds: (
    _: readonly string[] | ((prevState: readonly string[]) => string[]),
  ) => void;
  setPanelDocToDisplay: (panelType: string) => void;
  panelDocToDisplay: string;
  getPanelDocToDisplay: () => string;
  selectAllPanels: () => void;
  togglePanelSelected: (panelId: string, containingTabId: string | undefined) => void;
};

const CurrentLayoutContext = createContext<ICurrentLayout | undefined>(undefined);

export function usePanelMosaicId(): string {
  return useGuaranteedContext(CurrentLayoutContext).mosaicId;
}
export function useCurrentLayoutActions(): CurrentLayoutActions {
  return useGuaranteedContext(CurrentLayoutContext).actions;
}
export function useCurrentLayoutSelector<T>(selector: (layoutState: LayoutState) => T): T {
  const currentLayout = useGuaranteedContext(CurrentLayoutContext);
  const [_, forceUpdate] = useReducer((x: number) => x + 1, 0);

  const state = useRef<{ value: T; selector: typeof selector } | undefined>(undefined);
  if (!state.current || selector !== state.current.selector) {
    state.current = {
      value: selectWithUnstableIdentityWarning(
        currentLayout.actions.getCurrentLayoutState(),
        selector,
      ),
      selector,
    };
  }
  useLayoutEffect(() => {
    let mounted = true;
    const listener = (layoutState: LayoutState) => {
      // Note: Our removeLayoutStateListener is is too late if the layout state listeners are already
      // being invoked. Our component might become unmounted during the state listener invocation
      if (!mounted) {
        return;
      }
      const newValue = selectWithUnstableIdentityWarning(layoutState, selector);
      if (newValue === state.current?.value) {
        return;
      }
      state.current = {
        value: newValue,
        selector,
      };
      forceUpdate();
    };
    // Update if necessary, i.e. if the state has changed between render and this effect
    listener(currentLayout.actions.getCurrentLayoutState());
    currentLayout.addLayoutStateListener(listener);
    return () => {
      mounted = false;
      currentLayout.removeLayoutStateListener(listener);
    };
  }, [currentLayout, selector]);

  return state.current.value;
}
export function useSelectedPanels(): SelectedPanelActions {
  const currentLayout = useGuaranteedContext(CurrentLayoutContext);
  const [selectedPanelIds, setSelectedPanelIdsState] = useState(() =>
    currentLayout.getSelectedPanelIds(),
  );
  const [panelDocToDisplay, setPanelDocToDisplayState] = useState(() =>
    currentLayout.getPanelDocToDisplay(),
  );
  useLayoutEffect(() => {
    const listener = (newIds: readonly string[]) => setSelectedPanelIdsState(newIds);
    currentLayout.addSelectedPanelIdsListener(listener);
    return () => currentLayout.removeSelectedPanelIdsListener(listener);
  }, [currentLayout]);

  useLayoutEffect(() => {
    const listener = (panelType: string) => setPanelDocToDisplayState(panelType);
    currentLayout.addPanelDocToDisplayListener(listener);
    return () => currentLayout.removePanelDocToDisplayListener(listener);
  }, [currentLayout]);

  const setSelectedPanelIds = useGuaranteedContext(CurrentLayoutContext).setSelectedPanelIds;
  const getSelectedPanelIds = useGuaranteedContext(CurrentLayoutContext).getSelectedPanelIds;
  const setPanelDocToDisplay = useGuaranteedContext(CurrentLayoutContext).setPanelDocToDisplay;
  const getPanelDocToDisplay = useGuaranteedContext(CurrentLayoutContext).getPanelDocToDisplay;
  const { getCurrentLayoutState: getCurrentLayout } = useCurrentLayoutActions();

  const selectAllPanels = useCallback(() => {
    // eslint-disable-next-line no-restricted-syntax
    const panelIds = getLeaves(getCurrentLayout().selectedLayout?.data?.layout ?? null);
    setSelectedPanelIds(panelIds);
  }, [getCurrentLayout, setSelectedPanelIds]);

  const togglePanelSelected = useCallback(
    (panelId: string, containingTabId: string | undefined) => {
      setSelectedPanelIds((selectedIds) => {
        const { selectedLayout } = getCurrentLayout();
        if (!selectedLayout?.data) {
          return selectedIds;
        }
        return toggleSelectedPanel(
          panelId,
          containingTabId,
          selectedLayout.data.configById,
          selectedIds,
        );
      });
    },
    [setSelectedPanelIds, getCurrentLayout],
  );

  return useShallowMemo({
    getSelectedPanelIds,
    selectedPanelIds,
    setSelectedPanelIds,
    getPanelDocToDisplay,
    setPanelDocToDisplay,
    panelDocToDisplay,
    selectAllPanels,
    togglePanelSelected,
  });
}

export default CurrentLayoutContext;
