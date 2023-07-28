// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useCallback, useLayoutEffect, useReducer, useRef, useState } from "react";
import { getLeaves } from "react-mosaic-component";

import {
  useShallowMemo,
  selectWithUnstableIdentityWarning,
  useGuaranteedContext,
} from "@foxglove/hooks";
import Logger from "@foxglove/log";
import { VariableValue, RenderState } from "@foxglove/studio";
import useShouldNotChangeOften from "@foxglove/studio-base/hooks/useShouldNotChangeOften";
import toggleSelectedPanel from "@foxglove/studio-base/providers/CurrentLayoutProvider/toggleSelectedPanel";
import { PanelConfig, PlaybackConfig, UserNodes } from "@foxglove/studio-base/types/panels";

import {
  LayoutData,
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

type PanelType = string;

export type SharedPanelState = RenderState["sharedPanelState"];

export type LayoutID = string & { __brand: "LayoutID" };

export type SelectedLayout = {
  id: LayoutID;
  data: LayoutData | undefined;
  name?: string;
  edited?: boolean;
};

export type LayoutState = Readonly<{
  /**
   * Transient state shared between panels, keyed by panel type.
   */
  sharedPanelState?: Record<PanelType, SharedPanelState>;

  selectedLayout: SelectedLayout | undefined;
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

  /**
   * We use the same mosaicId for all mosaics (at the top level and within tabs) to support
   * dragging and dropping between them.
   */
  mosaicId: string;

  getSelectedPanelIds: () => readonly string[];
  setSelectedPanelIds: (
    _: readonly string[] | ((prevState: readonly string[]) => readonly string[]),
  ) => void;

  actions: {
    /**
     * Returns the current state - useful for click handlers and callbacks that read the state
     * asynchronously and don't want to update every time the state changes.
     */
    getCurrentLayoutState: () => LayoutState;

    /**
     * Override any current layout. This will reset the layout state
     */
    setCurrentLayout: (newLayout: SelectedLayout | undefined) => void;

    /**
     * Update the transient state associated with a particular panel type.
     */
    updateSharedPanelState: (type: PanelType, data: SharedPanelState) => void;

    savePanelConfigs: (payload: SaveConfigsPayload) => void;
    updatePanelConfigs: (panelType: string, updater: (config: PanelConfig) => PanelConfig) => void;
    createTabPanel: (payload: CreateTabPanelPayload) => void;
    changePanelLayout: (payload: ChangePanelLayoutPayload) => void;
    overwriteGlobalVariables: (payload: Record<string, VariableValue>) => void;
    setGlobalVariables: (payload: Record<string, VariableValue>) => void;
    setUserNodes: (payload: Partial<UserNodes>) => void;
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
  selectAllPanels: () => void;
  togglePanelSelected: (panelId: string, containingTabId: string | undefined) => void;
};

const log = Logger.getLogger(__filename);

const CurrentLayoutContext = createContext<ICurrentLayout | undefined>(undefined);
CurrentLayoutContext.displayName = "CurrentLayoutContext";

export function usePanelMosaicId(): string {
  return useGuaranteedContext(CurrentLayoutContext).mosaicId;
}

export function useCurrentLayoutActions(): CurrentLayoutActions {
  return useGuaranteedContext(CurrentLayoutContext).actions;
}

export function useCurrentLayoutSelector<T>(selector: (layoutState: LayoutState) => T): T {
  const currentLayout = useGuaranteedContext(CurrentLayoutContext);
  const [_, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // Catch locations using unstable function selectors
  useShouldNotChangeOften(selector, () =>
    log.warn(
      "useCurrentLayoutSelector is changing frequently. Rewrite your selector as a stable function.",
    ),
  );

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
  useLayoutEffect(() => {
    const listener = (newIds: readonly string[]) => setSelectedPanelIdsState(newIds);
    currentLayout.addSelectedPanelIdsListener(listener);
    return () => currentLayout.removeSelectedPanelIdsListener(listener);
  }, [currentLayout]);

  const setSelectedPanelIds = useGuaranteedContext(CurrentLayoutContext).setSelectedPanelIds;
  const getSelectedPanelIds = useGuaranteedContext(CurrentLayoutContext).getSelectedPanelIds;
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
    selectAllPanels,
    togglePanelSelected,
  });
}

export default CurrentLayoutContext;
