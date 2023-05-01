// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { difference, isEqual } from "lodash";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getNodeAtPath } from "react-mosaic-component";
import { useAsync, useAsyncFn, useMountedState } from "react-use";
import shallowequal from "shallowequal";
import { v4 as uuidv4 } from "uuid";

import { useShallowMemo } from "@foxglove/hooks";
import Logger from "@foxglove/log";
import { VariableValue } from "@foxglove/studio";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import CurrentLayoutContext, {
  ICurrentLayout,
  LayoutID,
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
  SaveConfigsPayload,
  SplitPanelPayload,
  StartDragPayload,
  SwapPanelPayload,
} from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { useLayoutManager } from "@foxglove/studio-base/context/LayoutManagerContext";
import { useUserProfileStorage } from "@foxglove/studio-base/context/UserProfileStorageContext";
import { defaultLayout } from "@foxglove/studio-base/providers/CurrentLayoutProvider/defaultLayout";
import panelsReducer from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";
import { LayoutManagerEventTypes } from "@foxglove/studio-base/services/ILayoutManager";
import { PanelConfig, PlaybackConfig, UserNodes } from "@foxglove/studio-base/types/panels";
import { windowAppURLState } from "@foxglove/studio-base/util/appURLState";
import { getPanelTypeFromId } from "@foxglove/studio-base/util/layout";

import { IncompatibleLayoutVersionAlert } from "./IncompatibleLayoutVersionAlert";

const log = Logger.getLogger(__filename);

export const MAX_SUPPORTED_LAYOUT_VERSION = 1;

/**
 * Concrete implementation of CurrentLayoutContext.Provider which handles
 * automatically restoring the current layout from LayoutStorage.
 */
export default function CurrentLayoutProvider({
  children,
}: React.PropsWithChildren<unknown>): JSX.Element {
  const { enqueueSnackbar } = useSnackbar();
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
  const [incompatibleLayoutVersionError, setIncompatibleLayoutVersionError] = useState(false);
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
      const newValue = typeof value === "function" ? value(selectedPanelIds.current) : value;
      if (!shallowequal(newValue, selectedPanelIds.current)) {
        selectedPanelIds.current = newValue;
        for (const listener of [...selectedPanelIdsListeners.current]) {
          listener(selectedPanelIds.current);
        }
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
        const layoutVersion = layout?.baseline.data.version;
        if (layoutVersion != undefined && layoutVersion > MAX_SUPPORTED_LAYOUT_VERSION) {
          setIncompatibleLayoutVersionError(true);
          setLayoutState({ selectedLayout: undefined });
          return;
        }
        if (!isMounted()) {
          return;
        }
        setIncompatibleLayoutVersionError(false);
        if (layout == undefined) {
          setLayoutState({ selectedLayout: undefined });
        } else {
          setLayoutState({
            selectedLayout: {
              loading: false,
              id: layout.id,
              data: layout.working?.data ?? layout.baseline.data,
              name: layout.name,
            },
          });
          if (saveToProfile) {
            setUserProfile({ currentLayoutId: id }).catch((error) => {
              console.error(error);
              enqueueSnackbar(`The current layout could not be saved. ${error.toString()}`, {
                variant: "error",
              });
            });
          }
        }
      } catch (error) {
        console.error(error);
        enqueueSnackbar(`The layout could not be loaded. ${error.toString()}`, {
          variant: "error",
        });
        setIncompatibleLayoutVersionError(false);
        setLayoutState({ selectedLayout: undefined });
      }
    },
    [enqueueSnackbar, isMounted, layoutManager, setLayoutState, setUserProfile],
  );

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

      // The panel state did not change, so no need to perform layout state
      // updates or layout manager updates.
      if (isEqual(oldData, newData)) {
        log.warn("Panel action resulted in identical config:", action);
        return;
      }

      setLayoutState({
        selectedLayout: {
          id: layoutStateRef.current.selectedLayout.id,
          data: newData,
          loading: false,
          name: layoutStateRef.current.selectedLayout.name,
          edited: true,
        },
      });
    },
    [setLayoutState],
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
            name: updatedLayout.name,
          },
        });
      }
    };
    layoutManager.on("change", listener);
    return () => {
      layoutManager.off("change", listener);
    };
  }, [layoutManager, setLayoutState]);

  // Make sure our layout still exists after changes. If not deselect it.
  useEffect(() => {
    const listener: LayoutManagerEventTypes["change"] = async (event) => {
      if (event.type !== "delete" || !layoutStateRef.current.selectedLayout?.id) {
        return;
      }

      if (event.layoutId === layoutStateRef.current.selectedLayout.id) {
        const layouts = await layoutManager.getLayouts();
        await setSelectedLayoutId(layouts[0]?.id);
      }
    };

    layoutManager.on("change", listener);
    return () => layoutManager.off("change", listener);
  }, [enqueueSnackbar, layoutManager, setSelectedLayoutId]);

  // Load initial state by re-selecting the last selected layout from the UserProfile.
  useAsync(async () => {
    // Don't restore the layout if there's one specified in the app state url.
    if (windowAppURLState()?.layoutId) {
      return;
    }

    // Retreive the selected layout id from the user's profile. If there's no layout specified
    // or we can't load it then save and select a default layout.
    const { currentLayoutId } = await getUserProfile();
    const layout = currentLayoutId ? await layoutManager.getLayout(currentLayoutId) : undefined;
    if (layout) {
      await setSelectedLayoutId(currentLayoutId, { saveToProfile: false });
    } else {
      const newLayout = await layoutManager.saveNewLayout({
        name: "Default",
        data: defaultLayout,
        permission: "CREATOR_WRITE",
      });
      await setSelectedLayoutId(newLayout.id);
    }
  }, [getUserProfile, layoutManager, setSelectedLayoutId]);

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
        void analytics.logEvent(AppEvent.PANEL_ADD, { type: "Tab" });
      },
      changePanelLayout: (payload: ChangePanelLayoutPayload) =>
        performAction({ type: "CHANGE_PANEL_LAYOUT", payload }),
      overwriteGlobalVariables: (payload: Record<string, VariableValue>) =>
        performAction({ type: "OVERWRITE_GLOBAL_DATA", payload }),
      setGlobalVariables: (payload: Record<string, VariableValue>) =>
        performAction({ type: "SET_GLOBAL_DATA", payload }),
      setUserNodes: (payload: Partial<UserNodes>) =>
        performAction({ type: "SET_USER_NODES", payload }),
      setPlaybackConfig: (payload: Partial<PlaybackConfig>) =>
        performAction({ type: "SET_PLAYBACK_CONFIG", payload }),
      closePanel: (payload: ClosePanelPayload) => {
        performAction({ type: "CLOSE_PANEL", payload });

        const closedId = getNodeAtPath(payload.root, payload.path);
        // Deselect the removed panel
        setSelectedPanelIds((ids) => ids.filter((id) => id !== closedId));

        void analytics.logEvent(
          AppEvent.PANEL_DELETE,
          typeof closedId === "string" ? { type: getPanelTypeFromId(closedId) } : undefined,
        );
      },
      splitPanel: (payload: SplitPanelPayload) => performAction({ type: "SPLIT_PANEL", payload }),
      swapPanel: (payload: SwapPanelPayload) => {
        // Select the new panel if the original panel was selected. We don't know what
        // the new panel id will be so we diff the panelIds of the old and
        // new layout so we can select the new panel.
        const originalIsSelected = selectedPanelIds.current.includes(payload.originalId);
        const beforePanelIds = Object.keys(
          layoutStateRef.current.selectedLayout?.data?.configById ?? {},
        );
        performAction({ type: "SWAP_PANEL", payload });
        if (originalIsSelected) {
          const afterPanelIds = Object.keys(
            layoutStateRef.current.selectedLayout?.data?.configById ?? {},
          );
          setSelectedPanelIds(difference(afterPanelIds, beforePanelIds));
        }
        void analytics.logEvent(AppEvent.PANEL_ADD, { type: payload.type, action: "swap" });
        void analytics.logEvent(AppEvent.PANEL_DELETE, {
          type: getPanelTypeFromId(payload.originalId),
          action: "swap",
        });
      },
      moveTab: (payload: MoveTabPayload) => performAction({ type: "MOVE_TAB", payload }),
      addPanel: (payload: AddPanelPayload) => {
        performAction({ type: "ADD_PANEL", payload });
        void analytics.logEvent(AppEvent.PANEL_ADD, { type: getPanelTypeFromId(payload.id) });
      },
      dropPanel: (payload: DropPanelPayload) => {
        performAction({ type: "DROP_PANEL", payload });
        void analytics.logEvent(AppEvent.PANEL_ADD, {
          type: payload.newPanelType,
          action: "drop",
        });
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

  return (
    <CurrentLayoutContext.Provider value={value}>
      {children}
      {incompatibleLayoutVersionError && (
        <IncompatibleLayoutVersionAlert onClose={() => setIncompatibleLayoutVersionError(false)} />
      )}
    </CurrentLayoutContext.Provider>
  );
}
