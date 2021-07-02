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

export type StateHistory<T> = {
  // All states stored in time order
  currentState: T;
  redoStates: T[];
  undoStates: T[];
};

export const pushState = <T>(
  history: StateHistory<T>,
  newState: T,
  maxHistory: number = Infinity,
): StateHistory<T> => {
  return {
    currentState: newState,
    redoStates: [],
    undoStates: [...history.undoStates, history.currentState].slice(-maxHistory),
  };
};

export const undoChange = <T>(history: StateHistory<T>): StateHistory<T> => {
  const previousState = history.undoStates[history.undoStates.length - 1];
  if (previousState == undefined) {
    // Return existing state if we have no history.
    // Do not ask users to call "canUndo", do not push dummy items onto the redo queue.
    return history;
  }

  return {
    currentState: previousState,
    redoStates: [history.currentState, ...history.redoStates],
    undoStates: history.undoStates.slice(0, -1),
  };
};

export const redoChange = <T>(history: StateHistory<T>): StateHistory<T> => {
  const newState = history.redoStates[0];
  if (newState == undefined) {
    // Return existing state if we have no redo items.
    // Do not ask users to call "canRedo", do not push dummy items onto the undo queue.
    return history;
  }
  return {
    currentState: newState,
    redoStates: history.redoStates.slice(1),
    undoStates: [...history.undoStates, history.currentState],
  };
};
