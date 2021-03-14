// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { isEqual } from "lodash";

import { ActionTypes } from "@foxglove-studio/app/actions";
import { panelEditingActions } from "@foxglove-studio/app/actions/panels";
import { State, PersistedState } from "@foxglove-studio/app/reducers";
import { EditHistoryOptions } from "@foxglove-studio/app/types/panels";
import {
  pushState,
  redoChange,
  undoChange,
  StateHistory,
} from "@foxglove-studio/app/util/stateHistory";

const LAYOUT_HISTORY_SIZE = 20;
// Threshold is a guess, and could be refined if it seems we're saving too few or too many entries
// in the undo/redo history.
export const NEVER_PUSH_LAYOUT_THRESHOLD_MS = 1000; // Exported for tests

type UndoRedoState = { persistedState: PersistedState; url: string };
export type LayoutHistory = {
  redoStates: UndoRedoState[];
  undoStates: UndoRedoState[];
  // We want to avoid pushing too many states onto the undo history when actions are quickly
  // dispatched -- either automatically, or as the result of quick user interactions like typing or
  // continuous scrolls/drags. While actions continue uninterrupted, do not create "save points".
  lastTimestamp: number;
};

export const initialLayoutHistoryState: LayoutHistory = {
  undoStates: [],
  redoStates: [],
  lastTimestamp: 0,
};

// Helper to encode the panels and layout history as a StateHistory object so we can do generic
// push, undo and redo operations.
const toStateHistory = (
  persistedState: PersistedState,
  { redoStates, undoStates }: LayoutHistory,
): StateHistory<UndoRedoState> => {
  return {
    currentState: {
      persistedState,
      url: window.location.href,
    },
    redoStates,
    undoStates,
  };
};

// Helper to decode a generic StateHistory object into panels and layoutHistory to store in redux.
const fromStateHistory = (
  stateHistory: StateHistory<UndoRedoState>,
): { undoRedoState: UndoRedoState; layoutHistory: LayoutHistory } => {
  const { currentState, redoStates, undoStates } = stateHistory;
  return {
    undoRedoState: currentState,
    // After undo/redo, any subsequent layout action should result in the state being pushed onto
    // the undo history.
    layoutHistory: { ...initialLayoutHistoryState, redoStates, undoStates },
  };
};

const redoLayoutChange = (
  persistedState: PersistedState,
  layoutHistory: LayoutHistory,
): { undoRedoState: UndoRedoState; layoutHistory: LayoutHistory } => {
  return fromStateHistory(redoChange(toStateHistory(persistedState, layoutHistory)));
};

const undoLayoutChange = (
  persistedState: PersistedState,
  layoutHistory: LayoutHistory,
): { undoRedoState: UndoRedoState; layoutHistory: LayoutHistory } => {
  return fromStateHistory(undoChange(toStateHistory(persistedState, layoutHistory)));
};

const pushLayoutChange = (
  oldPersistedState: PersistedState | undefined,
  newPersistedState: PersistedState,
  layoutHistory: LayoutHistory,
  action: any,
): LayoutHistory => {
  const time = Date.now();
  const historyOptions: EditHistoryOptions | null | undefined = action.payload?.historyOptions;
  if (
    historyOptions === "SUPPRESS_HISTORY_ENTRY" ||
    isEqual(oldPersistedState, newPersistedState)
  ) {
    return layoutHistory;
  }
  if (oldPersistedState && time - layoutHistory.lastTimestamp > NEVER_PUSH_LAYOUT_THRESHOLD_MS) {
    const { undoStates, redoStates } = pushState(
      toStateHistory(oldPersistedState, layoutHistory),
      { persistedState: newPersistedState, url: window.location.href },
      LAYOUT_HISTORY_SIZE,
    );
    return { redoStates, undoStates, lastTimestamp: time };
  }
  // Don't need to push the old state onto the undo stack, because the previous action was quite
  // recent. Update the layoutHistory's lastTimestamp, though, so continuous actions can be
  // debounced forever.
  return { ...layoutHistory, lastTimestamp: time };
};

export default function (
  state: State,
  action: ActionTypes,
  oldPersistedState?: PersistedState,
): State {
  switch (action.type) {
    case "UNDO_LAYOUT_CHANGE": {
      const { undoRedoState, layoutHistory } = undoLayoutChange(
        state.persistedState,
        state.layoutHistory,
      );
      const { persistedState, url } = undoRedoState;
      history.replaceState(null, document.title, url);
      return { ...state, persistedState, layoutHistory };
    }
    case "REDO_LAYOUT_CHANGE": {
      const { undoRedoState, layoutHistory } = redoLayoutChange(
        state.persistedState,
        state.layoutHistory,
      );
      const { persistedState, url } = undoRedoState;
      history.replaceState(null, document.title, url);
      return { ...state, persistedState, layoutHistory };
    }
    default:
      if (panelEditingActions.has(action.type)) {
        const newLayoutHistory = pushLayoutChange(
          oldPersistedState,
          state.persistedState,
          state.layoutHistory,
          action,
        );
        return { ...state, layoutHistory: newLayoutHistory };
      }

      return { ...state };
  }
}
