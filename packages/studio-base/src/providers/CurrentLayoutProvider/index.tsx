// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { isEqual } from "lodash";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getNodeAtPath } from "react-mosaic-component";
import { useToasts } from "react-toast-notifications";
import { useAsync, useAsyncFn, useMountedState } from "react-use";
import { v4 as uuidv4 } from "uuid";

import { useShallowMemo } from "@foxglove/hooks";
import Logger from "@foxglove/log";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import CurrentLayoutContext, {
  ICurrentLayout,
  LayoutState,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import {
  AddPanelPayload,
  ChangePanelLayoutPayload,
  ClosePanelPayload,
  CreateTabPanelPayload,
  DropPanelPayload,
  EndDragPayload,
  MoveTabPayload,
  PanelsActions,
  PanelsState,
  SaveConfigsPayload,
  SplitPanelPayload,
  StartDragPayload,
  SwapPanelPayload,
} from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { useLayoutManager } from "@foxglove/studio-base/context/LayoutManagerContext";
import { useUserProfileStorage } from "@foxglove/studio-base/context/UserProfileStorageContext";
import { LinkedGlobalVariables } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import panelsReducer from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import { LayoutID } from "@foxglove/studio-base/services/ConsoleApi";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";
import { LayoutManagerEventTypes } from "@foxglove/studio-base/services/ILayoutManager";
import { PanelConfig, UserNodes, PlaybackConfig } from "@foxglove/studio-base/types/panels";
import { getPanelTypeFromId } from "@foxglove/studio-base/util/layout";

const log = Logger.getLogger(__filename);

const SAVE_INTERVAL_MS = 1000;

/**
 * Concrete implementation of CurrentLayoutContext.Provider which handles automatically saving and
 * restoring the current layout from LayoutStorage.
 */
export default function CurrentLayoutProvider({
  children,
}: React.PropsWithChildren<unknown>): JSX.Element {
  const { addToast } = useToasts();
  const { getUserProfile, setUserProfile } = useUserProfileStorage();
  const layoutManager = useLayoutManager();
  const analytics = useAnalytics();
  const isMounted = useMountedState();

  const [mosaicId] = useState(() => uuidv4());

  const layoutStateListeners = useRef(new Set<(_: LayoutState) => void>());
  const addLayoutStateListener = useCallback((listener: (_: LayoutState) => void) => {
    layoutStateListeners.current.add(listener);
  }, []);
  const removeLayoutStateListener = useCallback((listener: (_: LayoutState) => void) => {
    layoutStateListeners.current.delete(listener);
  }, []);

  const [layoutState, setLayoutStateInternal] = useState<LayoutState>({
    selectedLayout: undefined,
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

  const selectedPanelIds = useRef<readonly string[]>([]);
  const selectedPanelIdsListeners = useRef(new Set<(_: readonly string[]) => void>());
  const addSelectedPanelIdsListener = useCallback((listener: (_: readonly string[]) => void) => {
    selectedPanelIdsListeners.current.add(listener);
  }, []);
  const removeSelectedPanelIdsListener = useCallback((listener: (_: readonly string[]) => void) => {
    selectedPanelIdsListeners.current.delete(listener);
  }, []);

  const getSelectedPanelIds = useCallback(() => selectedPanelIds.current, []);
  const setSelectedPanelIds = useCallback(
    (value: readonly string[] | ((prevState: readonly string[]) => readonly string[])): void => {
      selectedPanelIds.current =
        typeof value === "function" ? value(selectedPanelIds.current) : value;
      for (const listener of [...selectedPanelIdsListeners.current]) {
        listener(selectedPanelIds.current);
      }
    },
    [],
  );

  const [, setSelectedLayoutId] = useAsyncFn(
    async (
      id: LayoutID | undefined,
      { saveToProfile = true }: { saveToProfile?: boolean } = {},
    ) => {
      if (id == undefined) {
        setLayoutState({ selectedLayout: undefined });
        return;
      }
      try {
        setLayoutState({ selectedLayout: { id, loading: true, data: undefined } });
        const layout = await layoutManager.getLayout(id);
        if (!isMounted()) {
          return;
        }
        if (layout == undefined) {
          setLayoutState({ selectedLayout: undefined });
        } else {
          setLayoutState({
            selectedLayout: {
              loading: false,
              id: layout.id,
              data: layout.working?.data ?? layout.baseline.data,
            },
          });
          if (saveToProfile) {
            setUserProfile({ currentLayoutId: id }).catch((error) => {
              console.error(error);
              addToast(`The current layout could not be saved. ${error.toString()}`, {
                appearance: "error",
              });
            });
          }
        }
      } catch (error) {
        console.error(error);
        addToast(`The layout could not be loaded. ${error.toString()}`, { appearance: "error" });
        setLayoutState({ selectedLayout: undefined });
      }
    },
    [addToast, isMounted, layoutManager, setLayoutState, setUserProfile],
  );

  type UpdateLayoutParams = { id: LayoutID; data: PanelsState };
  const unsavedLayoutsRef = useRef(new Map<LayoutID, UpdateLayoutParams>());

  // When the user performs an action, we immediately setLayoutState to update the UI. Saving back
  // to the LayoutManager is debounced.
  const debouncedSaveTimeout = useRef<ReturnType<typeof setTimeout>>();
  const performAction = useCallback(
    (action: PanelsActions) => {
      if (
        layoutStateRef.current.selectedLayout?.data == undefined ||
        layoutStateRef.current.selectedLayout.loading === true
      ) {
        return;
      }
      const oldData = layoutStateRef.current.selectedLayout.data;
      const newData = panelsReducer(oldData, action);

      // the panel state did not change, so no need to perform layout state updates or layout manager updates
      if (isEqual(oldData, newData)) {
        return;
      }

      const newLayout = {
        id: layoutStateRef.current.selectedLayout.id,
        data: newData,
      };

      // store the layout for saving
      unsavedLayoutsRef.current.set(newLayout.id, newLayout);

      debouncedSaveTimeout.current ??= setTimeout(() => {
        const layoutsToSave = [...unsavedLayoutsRef.current.values()];
        unsavedLayoutsRef.current.clear();

        debouncedSaveTimeout.current = undefined;
        for (const params of layoutsToSave) {
          layoutManager.updateLayout(params).catch((error) => {
            log.error(error);
            if (isMounted()) {
              addToast(`Your changes could not be saved. ${error.toString()}`, {
                appearance: "error",
                id: "CurrentLayoutProvider.throttledSave",
              });
            }
          });
        }
      }, SAVE_INTERVAL_MS);

      // Some actions like CHANGE_PANEL_LAYOUT will cause further downstream effects to update panel
      // configs (i.e. set default configs). These result in calls to performAction. To ensure the
      // debounced params are set in the proper order, we invoke setLayoutState at the end.
      setLayoutState({ selectedLayout: { ...newLayout, loading: false } });
    },
    [addToast, isMounted, layoutManager, setLayoutState],
  );

  // Changes to the layout storage from external user actions (such as resetting a layout to a
  // previous saved state) need to trigger setLayoutState.
  useEffect(() => {
    const listener: LayoutManagerEventTypes["change"] = ({ updatedLayout }) => {
      if (
        updatedLayout &&
        layoutStateRef.current.selectedLayout &&
        updatedLayout.id === layoutStateRef.current.selectedLayout.id
      ) {
        setLayoutState({
          selectedLayout: {
            loading: false,
            id: updatedLayout.id,
            data: updatedLayout.working?.data ?? updatedLayout.baseline.data,
          },
        });
      }
    };
    layoutManager.on("change", listener);
    return () => layoutManager.off("change", listener);
  }, [layoutManager, setLayoutState]);

  // Load initial state by re-selecting the last selected layout from the UserProfile
  useAsync(async () => {
    const { currentLayoutId } = await getUserProfile();
    await setSelectedLayoutId(currentLayoutId, { saveToProfile: false });
  }, [getUserProfile, setSelectedLayoutId]);

  const actions: ICurrentLayout["actions"] = useMemo(
    () => ({
      setSelectedLayoutId,
      getCurrentLayoutState: () => layoutStateRef.current,

      savePanelConfigs: (payload: SaveConfigsPayload) =>
        performAction({ type: "SAVE_PANEL_CONFIGS", payload }),
      updatePanelConfigs: (panelType: string, perPanelFunc: (config: PanelConfig) => PanelConfig) =>
        performAction({ type: "SAVE_FULL_PANEL_CONFIG", payload: { panelType, perPanelFunc } }),
      createTabPanel: (payload: CreateTabPanelPayload) => {
        performAction({ type: "CREATE_TAB_PANEL", payload });
        setSelectedPanelIds([]);
        analytics?.logEvent(AppEvent.PANEL_ADD, { type: "Tab" });
      },
      changePanelLayout: (payload: ChangePanelLayoutPayload) =>
        performAction({ type: "CHANGE_PANEL_LAYOUT", payload }),
      overwriteGlobalVariables: (payload: { [key: string]: unknown }) =>
        performAction({ type: "OVERWRITE_GLOBAL_DATA", payload }),
      setGlobalVariables: (payload: { [key: string]: unknown }) =>
        performAction({ type: "SET_GLOBAL_DATA", payload }),
      setUserNodes: (payload: Partial<UserNodes>) =>
        performAction({ type: "SET_USER_NODES", payload }),
      setLinkedGlobalVariables: (payload: LinkedGlobalVariables) =>
        performAction({ type: "SET_LINKED_GLOBAL_VARIABLES", payload }),
      setPlaybackConfig: (payload: Partial<PlaybackConfig>) =>
        performAction({ type: "SET_PLAYBACK_CONFIG", payload }),
      closePanel: (payload: ClosePanelPayload) => {
        performAction({ type: "CLOSE_PANEL", payload });

        const closedId = getNodeAtPath(payload.root, payload.path);
        // Deselect the removed panel
        setSelectedPanelIds((ids) => ids.filter((id) => id !== closedId));

        analytics?.logEvent(
          AppEvent.PANEL_DELETE,
          typeof closedId === "string" ? { type: getPanelTypeFromId(closedId) } : undefined,
        );
      },
      splitPanel: (payload: SplitPanelPayload) => performAction({ type: "SPLIT_PANEL", payload }),
      swapPanel: (payload: SwapPanelPayload) => {
        performAction({ type: "SWAP_PANEL", payload });
        analytics?.logEvent(AppEvent.PANEL_ADD, { type: payload.type, action: "swap" });
        analytics?.logEvent(AppEvent.PANEL_DELETE, {
          type: getPanelTypeFromId(payload.originalId),
          action: "swap",
        });
      },
      moveTab: (payload: MoveTabPayload) => performAction({ type: "MOVE_TAB", payload }),
      addPanel: (payload: AddPanelPayload) => {
        performAction({ type: "ADD_PANEL", payload });
        analytics?.logEvent(AppEvent.PANEL_ADD, { type: getPanelTypeFromId(payload.id) });
      },
      dropPanel: (payload: DropPanelPayload) => {
        performAction({ type: "DROP_PANEL", payload });
        analytics?.logEvent(AppEvent.PANEL_ADD, { type: payload.newPanelType, action: "drop" });
      },
      startDrag: (payload: StartDragPayload) => performAction({ type: "START_DRAG", payload }),
      endDrag: (payload: EndDragPayload) => performAction({ type: "END_DRAG", payload }),
    }),
    [analytics, performAction, setSelectedLayoutId, setSelectedPanelIds],
  );

  const value: ICurrentLayout = useShallowMemo({
    addLayoutStateListener,
    removeLayoutStateListener,
    addSelectedPanelIdsListener,
    removeSelectedPanelIdsListener,
    mosaicId,
    getSelectedPanelIds,
    setSelectedPanelIds,
    actions,
  });

  return <CurrentLayoutContext.Provider value={value}>{children}</CurrentLayoutContext.Provider>;
}
