// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { useCallback, useMemo, useRef, useState } from "react";
import { getNodeAtPath } from "react-mosaic-component";
import shallowequal from "shallowequal";
import { v4 as uuidv4 } from "uuid";

import { useShallowMemo } from "@foxglove/hooks";
import Logger from "@foxglove/log";
import { VariableValue } from "@foxglove/studio";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import CurrentLayoutContext, {
  ICurrentLayout,
  LayoutState,
  SelectedLayout,
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
import panelsReducer from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";
import { PanelConfig, PlaybackConfig, UserNodes } from "@foxglove/studio-base/types/panels";
import { getPanelTypeFromId } from "@foxglove/studio-base/util/layout";

import { IncompatibleLayoutVersionAlert } from "./IncompatibleLayoutVersionAlert";

const log = Logger.getLogger(__filename);

export const MAX_SUPPORTED_LAYOUT_VERSION = 1;

/**
 * Concrete implementation of CurrentLayoutContext.Provider which handles
 * automatically restoring the current layout from LayoutStorage.
 */
export default function CurrentLayoutProvider({ children }: React.PropsWithChildren): JSX.Element {
  const analytics = useAnalytics();

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

  const performAction = useCallback(
    (action: PanelsActions) => {
      if (layoutStateRef.current.selectedLayout?.data == undefined) {
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
          data: newData,
          name: layoutStateRef.current.selectedLayout.name,
          edited: true,
        },
      });
    },
    [setLayoutState],
  );

  const setCurrentLayout = useCallback(
    (newLayout: SelectedLayout | undefined) => {
      setLayoutState({
        sharedPanelState: {},
        selectedLayout: newLayout,
      });
    },
    [setLayoutState],
  );

  const updateSharedPanelState = useCallback<ICurrentLayout["actions"]["updateSharedPanelState"]>(
    (type, newSharedState) => {
      if (layoutStateRef.current.selectedLayout?.data == undefined) {
        return;
      }

      setLayoutState({
        ...layoutStateRef.current,
        sharedPanelState: { ...layoutStateRef.current.sharedPanelState, [type]: newSharedState },
      });
    },
    [setLayoutState],
  );

  const actions: ICurrentLayout["actions"] = useMemo(
    () => ({
      getCurrentLayoutState: () => layoutStateRef.current,
      setCurrentLayout,

      updateSharedPanelState,

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
      setUserNodes: (payload: Partial<UserNodes>) => {
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
    [analytics, performAction, setCurrentLayout, setSelectedPanelIds, updateSharedPanelState],
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
