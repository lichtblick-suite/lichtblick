// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { isEqual } from "lodash";
import { getNodeAtPath } from "react-mosaic-component";
import { v4 as uuidv4 } from "uuid";

import { CurrentLayout } from "@foxglove/studio-base/context/CurrentLayoutContext";
import {
  ADD_PANEL,
  CHANGE_PANEL_LAYOUT,
  CLOSE_PANEL,
  CREATE_TAB_PANEL,
  DROP_PANEL,
  END_DRAG,
  LOAD_LAYOUT,
  MOVE_TAB,
  OVERWRITE_GLOBAL_DATA,
  PanelsActions,
  PanelsState,
  SAVE_FULL_PANEL_CONFIG,
  SAVE_PANEL_CONFIGS,
  SET_GLOBAL_DATA,
  SET_LINKED_GLOBAL_VARIABLES,
  SET_PLAYBACK_CONFIG,
  SET_STUDIO_NODES,
  SPLIT_PANEL,
  START_DRAG,
  SWAP_PANEL,
} from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import panelsReducer, {
  defaultPlaybackConfig,
} from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";
import UndoRedo from "@foxglove/studio-base/util/UndoRedo";

export const DEFAULT_LAYOUT_FOR_TESTS: PanelsState = {
  id: "FOR_TESTS",
  name: "FOR_TESTS",
  configById: {},
  globalVariables: {},
  userNodes: {},
  linkedGlobalVariables: [],
  playbackConfig: defaultPlaybackConfig,
};

const LAYOUT_HISTORY_SIZE = 20;
const LAYOUT_HISTORY_THROTTLE_MS = 1000;

export default class CurrentLayoutState implements CurrentLayout {
  private undoRedo: UndoRedo<PanelsState>;
  private panelsState: PanelsState;
  private panelsStateListeners = new Set<(_: PanelsState) => void>();
  private selectedPanelIds: readonly string[] = [];
  private selectedPanelIdsListeners = new Set<(_: readonly string[]) => void>();

  mosaicId = uuidv4();

  constructor(initialState: PanelsState) {
    this.panelsState = initialState;
    // Run the reducer once to ensure any migrations happen (e.g. savedProps->configById)
    this.dispatch({ type: "LOAD_LAYOUT", payload: initialState });

    this.undoRedo = new UndoRedo<PanelsState>(this.panelsState, {
      isEqual,
      historySize: LAYOUT_HISTORY_SIZE,
      throttleMs: LAYOUT_HISTORY_THROTTLE_MS,
    });

    this.addPanelsStateListener((state) => {
      this.undoRedo.updateState(state);
    });
  }

  addPanelsStateListener = (listener: (_: PanelsState) => void): void => {
    this.panelsStateListeners.add(listener);
  };
  removePanelsStateListener = (listener: (_: PanelsState) => void): void => {
    this.panelsStateListeners.delete(listener);
  };
  addSelectedPanelIdsListener = (listener: (_: readonly string[]) => void): void => {
    this.selectedPanelIdsListeners.add(listener);
  };
  removeSelectedPanelIdsListener = (listener: (_: readonly string[]) => void): void => {
    this.selectedPanelIdsListeners.delete(listener);
  };

  setSelectedPanelIds = (
    value: readonly string[] | ((prevState: readonly string[]) => string[]),
  ): void => {
    this.selectedPanelIds = typeof value === "function" ? value(this.selectedPanelIds) : value;
    for (const listener of [...this.selectedPanelIdsListeners]) {
      listener(this.selectedPanelIds);
    }
  };
  getSelectedPanelIds = (): readonly string[] => {
    return this.selectedPanelIds;
  };

  actions = {
    getCurrentLayout: (): PanelsState => this.panelsState,
    undoLayoutChange: (): void => this.undoRedo.undo(this.actions.loadLayout),
    redoLayoutChange: (): void => this.undoRedo.redo(this.actions.loadLayout),

    savePanelConfigs: (payload: SAVE_PANEL_CONFIGS["payload"]): void =>
      this.dispatch({ type: "SAVE_PANEL_CONFIGS", payload }),
    updatePanelConfigs: (
      panelType: SAVE_FULL_PANEL_CONFIG["payload"]["panelType"],
      perPanelFunc: SAVE_FULL_PANEL_CONFIG["payload"]["perPanelFunc"],
    ): void =>
      this.dispatch({ type: "SAVE_FULL_PANEL_CONFIG", payload: { panelType, perPanelFunc } }),
    createTabPanel: (payload: CREATE_TAB_PANEL["payload"]): void => {
      this.dispatch({ type: "CREATE_TAB_PANEL", payload });
      this.setSelectedPanelIds([]);
    },
    changePanelLayout: (payload: CHANGE_PANEL_LAYOUT["payload"]): void =>
      this.dispatch({ type: "CHANGE_PANEL_LAYOUT", payload }),
    loadLayout: (payload: LOAD_LAYOUT["payload"]): void =>
      this.dispatch({ type: "LOAD_LAYOUT", payload }),
    overwriteGlobalVariables: (payload: OVERWRITE_GLOBAL_DATA["payload"]): void =>
      this.dispatch({ type: "OVERWRITE_GLOBAL_DATA", payload }),
    setGlobalVariables: (payload: SET_GLOBAL_DATA["payload"]): void =>
      this.dispatch({ type: "SET_GLOBAL_DATA", payload }),
    setUserNodes: (payload: SET_STUDIO_NODES["payload"]): void =>
      this.dispatch({ type: "SET_USER_NODES", payload }),
    setLinkedGlobalVariables: (payload: SET_LINKED_GLOBAL_VARIABLES["payload"]): void =>
      this.dispatch({ type: "SET_LINKED_GLOBAL_VARIABLES", payload }),
    setPlaybackConfig: (payload: SET_PLAYBACK_CONFIG["payload"]): void =>
      this.dispatch({ type: "SET_PLAYBACK_CONFIG", payload }),
    closePanel: (payload: CLOSE_PANEL["payload"]): void => {
      this.dispatch({ type: "CLOSE_PANEL", payload });
      // Deselect the removed panel
      const closedId = getNodeAtPath(payload.root, payload.path);
      this.setSelectedPanelIds((ids) => ids.filter((id) => id !== closedId));
    },
    splitPanel: (payload: SPLIT_PANEL["payload"]): void =>
      this.dispatch({ type: "SPLIT_PANEL", payload }),
    swapPanel: (payload: SWAP_PANEL["payload"]): void =>
      this.dispatch({ type: "SWAP_PANEL", payload }),
    moveTab: (payload: MOVE_TAB["payload"]): void => this.dispatch({ type: "MOVE_TAB", payload }),
    addPanel: (payload: ADD_PANEL["payload"]): void =>
      this.dispatch({ type: "ADD_PANEL", payload }),
    dropPanel: (payload: DROP_PANEL["payload"]): void =>
      this.dispatch({ type: "DROP_PANEL", payload }),
    startDrag: (payload: START_DRAG["payload"]): void =>
      this.dispatch({ type: "START_DRAG", payload }),
    endDrag: (payload: END_DRAG["payload"]): void => this.dispatch({ type: "END_DRAG", payload }),
  };

  private dispatch(action: PanelsActions) {
    this.panelsState = panelsReducer(this.panelsState, action);
    for (const listener of [...this.panelsStateListeners]) {
      listener(this.panelsState);
    }
  }
}
