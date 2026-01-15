// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getNodeAtPath } from "react-mosaic-component";
import { useAsync, useAsyncFn, useMountedState } from "react-use";
import shallowequal from "shallowequal";
import { v4 as uuidv4 } from "uuid";

import { useShallowMemo } from "@lichtblick/hooks";
import Logger from "@lichtblick/log";
import { VariableValue } from "@lichtblick/suite";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { useAppParameters } from "@lichtblick/suite-base/context/AppParametersContext";
import CurrentLayoutContext, {
  ICurrentLayout,
  LayoutID,
  LayoutState,
} from "@lichtblick/suite-base/context/CurrentLayoutContext";
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
} from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import { useUserProfileStorage } from "@lichtblick/suite-base/context/UserProfileStorageContext";
import {
  BUSY_POLLING_INTERVAL_MS,
  BUSY_POLLING_TIMEOUT_MS,
  MAX_SUPPORTED_LAYOUT_VERSION,
  ORG_PERMISSION_PREFIX,
} from "@lichtblick/suite-base/providers/CurrentLayoutProvider/constants";
import { defaultLayout } from "@lichtblick/suite-base/providers/CurrentLayoutProvider/defaultLayout";
import useUpdateSharedPanelState from "@lichtblick/suite-base/providers/CurrentLayoutProvider/hooks/useUpdateSharedPanelState";
import { loadDefaultLayouts } from "@lichtblick/suite-base/providers/CurrentLayoutProvider/loadDefaultLayouts";
import panelsReducer from "@lichtblick/suite-base/providers/CurrentLayoutProvider/reducers";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";
import { LayoutLoader } from "@lichtblick/suite-base/services/ILayoutLoader";
import { LayoutManagerEventTypes } from "@lichtblick/suite-base/services/ILayoutManager";
import { PanelConfig, PlaybackConfig, UserScripts } from "@lichtblick/suite-base/types/panels";
import { windowAppURLState } from "@lichtblick/suite-base/util/appURLState";
import { getPanelTypeFromId } from "@lichtblick/suite-base/util/layout";

import { IncompatibleLayoutVersionAlert } from "./IncompatibleLayoutVersionAlert";

const log = Logger.getLogger(__filename);

/**
 * Concrete implementation of CurrentLayoutContext.Provider which handles
 * automatically restoring the current layout from LayoutStorage.
 */
export default function CurrentLayoutProvider({
  children,
  loaders = [],
}: React.PropsWithChildren<{
  loaders?: readonly LayoutLoader[];
}>): React.JSX.Element {
  const { enqueueSnackbar } = useSnackbar();
  const { getUserProfile, setUserProfile } = useUserProfileStorage();
  const layoutManager = useLayoutManager();
  const analytics = useAnalytics();
  const isMounted = useMountedState();

  const { t } = useTranslation("general");

  const appParameters = useAppParameters();

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
    const layoutVersion = newState.selectedLayout?.data?.version;
    if (layoutVersion != undefined && layoutVersion > MAX_SUPPORTED_LAYOUT_VERSION) {
      setIncompatibleLayoutVersionError(true);
      setLayoutStateInternal({ selectedLayout: undefined });
      return;
    }

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
            setUserProfile({ currentLayoutId: id }).catch((error: unknown) => {
              console.error(error);
              enqueueSnackbar(
                `The current layout could not be saved. ${(error as Error).toString()}`,
                {
                  variant: "error",
                },
              );
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
      if (_.isEqual(oldData, newData)) {
        log.warn("Panel action resulted in identical config:", action);
        return;
      }

      // Get all the panel types that exist in the new config
      const panelTypesInUse = _.uniq(Object.keys(newData.configById).map(getPanelTypeFromId));

      setLayoutState({
        // discared shared panel state for panel types that are no longer in the layout
        sharedPanelState: _.pick(layoutStateRef.current.sharedPanelState, panelTypesInUse),
        selectedLayout: {
          id: layoutStateRef.current.selectedLayout.id,
          data: newData,
          name: layoutStateRef.current.selectedLayout.name,
          edited: true,
        },
      });
    },
    [setLayoutState],
  );

  /**
   * Changes to the layout storage from external user actions need to trigger setLayoutState.
   * Before it was beeing trigged on every change. Now it is triggered only when the layout
   * is reverted, otherize it has some toggling issues when resizing panels.
   */
  useEffect(() => {
    const listener: LayoutManagerEventTypes["change"] = (event) => {
      const { updatedLayout } = event;
      if (
        event.type === "revert" &&
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
    return () => {
      layoutManager.off("change", listener);
    };
  }, [enqueueSnackbar, layoutManager, setSelectedLayoutId]);

  // Load initial state by re-selecting the last selected layout from the UserProfile.
  useAsync(async () => {
    // Don't restore the layout if there's one specified in the app state url.
    if (windowAppURLState()?.layoutId) {
      return;
    }

    // For some reason, this needs to go before the setSelectedLayoutId, probably some initialization
    const { currentLayoutId } = await getUserProfile();

    // Try to load default layouts, before checking to add the fallback "Default".
    await loadDefaultLayouts(layoutManager, loaders);

    // Wait for layout manager to finish any ongoing operations (e.g. fetching remote layouts)
    if (layoutManager.isBusy()) {
      await new Promise<void>((resolve) => {
        const startTime = Date.now();

        const checkBusy = () => {
          const elapsed = Date.now() - startTime;

          if (!layoutManager.isBusy()) {
            resolve();
          } else if (elapsed >= BUSY_POLLING_TIMEOUT_MS) {
            console.warn(
              `CurrentLayoutProvider: timeout after ${BUSY_POLLING_TIMEOUT_MS}ms, continuing anyway`,
            );
            resolve();
          } else {
            setTimeout(checkBusy, BUSY_POLLING_INTERVAL_MS);
          }
        };
        checkBusy();
      });
    }

    const layouts = await layoutManager.getLayouts();

    // Check if there's a layout specified by app parameter
    const defaultLayoutFromParameters = layouts.find((l) => l.name === appParameters.defaultLayout);
    if (defaultLayoutFromParameters) {
      await setSelectedLayoutId(defaultLayoutFromParameters.id, { saveToProfile: true });
      return;
    }

    // It there is a defaultLayout setted but didnt found a layout, show a error to the user
    if (appParameters.defaultLayout) {
      enqueueSnackbar(t("noDefaultLayoutParameter", { layoutName: appParameters.defaultLayout }), {
        variant: "warning",
      });
    }

    // Retreive the selected layout id from the user's profile. If there's no layout specified
    // or we can't load it then save and select a default layout
    const layout = currentLayoutId ? await layoutManager.getLayout(currentLayoutId) : undefined;

    if (layout) {
      await setSelectedLayoutId(currentLayoutId, { saveToProfile: false });
      return;
    }

    if (layouts.length > 0) {
      const orgLayouts = layouts.filter((l) => l.permission.startsWith(ORG_PERMISSION_PREFIX));
      const layoutsToSort = orgLayouts.length > 0 ? orgLayouts : layouts;
      const sortedLayouts = [...layoutsToSort].sort((a, b) => a.name.localeCompare(b.name));
      await setSelectedLayoutId(sortedLayouts[0]!.id);
      return;
    }

    const newLayout = await layoutManager.saveNewLayout({
      name: "Default",
      data: defaultLayout,
      permission: "CREATOR_WRITE",
    });
    await setSelectedLayoutId(newLayout.id);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getUserProfile, layoutManager, setSelectedLayoutId, enqueueSnackbar]);

  const { updateSharedPanelState } = useUpdateSharedPanelState(layoutStateRef, setLayoutState);

  const actions: ICurrentLayout["actions"] = useMemo(
    () => ({
      updateSharedPanelState,
      setCurrentLayout: () => {},
      setSelectedLayoutId,
      getCurrentLayoutState: () => layoutStateRef.current,

      savePanelConfigs: (payload: SaveConfigsPayload) => {
        performAction({ type: "SAVE_PANEL_CONFIGS", payload });
      },
      updatePanelConfigs: (
        panelType: string,
        perPanelFunc: (config: PanelConfig) => PanelConfig,
      ) => {
        performAction({ type: "SAVE_FULL_PANEL_CONFIG", payload: { panelType, perPanelFunc } });
      },
      createTabPanel: (payload: CreateTabPanelPayload) => {
        performAction({ type: "CREATE_TAB_PANEL", payload });
        setSelectedPanelIds([]);
        void analytics.logEvent(AppEvent.PANEL_ADD, { type: "Tab" });
      },
      changePanelLayout: (payload: ChangePanelLayoutPayload) => {
        performAction({ type: "CHANGE_PANEL_LAYOUT", payload });
      },
      overwriteGlobalVariables: (payload: Record<string, VariableValue>) => {
        performAction({ type: "OVERWRITE_GLOBAL_DATA", payload });
      },
      setGlobalVariables: (payload: Record<string, VariableValue>) => {
        performAction({ type: "SET_GLOBAL_DATA", payload });
      },
      setUserScripts: (payload: Partial<UserScripts>) => {
        performAction({ type: "SET_USER_NODES", payload });
      },
      setPlaybackConfig: (payload: Partial<PlaybackConfig>) => {
        performAction({ type: "SET_PLAYBACK_CONFIG", payload });
      },
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
      splitPanel: (payload: SplitPanelPayload) => {
        performAction({ type: "SPLIT_PANEL", payload });
      },
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
          setSelectedPanelIds(_.difference(afterPanelIds, beforePanelIds));
        }
        void analytics.logEvent(AppEvent.PANEL_ADD, { type: payload.type, action: "swap" });
        void analytics.logEvent(AppEvent.PANEL_DELETE, {
          type: getPanelTypeFromId(payload.originalId),
          action: "swap",
        });
      },
      moveTab: (payload: MoveTabPayload) => {
        performAction({ type: "MOVE_TAB", payload });
      },
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
      startDrag: (payload: StartDragPayload) => {
        performAction({ type: "START_DRAG", payload });
      },
      endDrag: (payload: EndDragPayload) => {
        performAction({ type: "END_DRAG", payload });
      },
    }),
    [analytics, performAction, setSelectedLayoutId, setSelectedPanelIds, updateSharedPanelState],
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
        <IncompatibleLayoutVersionAlert
          onClose={() => {
            setIncompatibleLayoutVersionError(false);
          }}
        />
      )}
    </CurrentLayoutContext.Provider>
  );
}
