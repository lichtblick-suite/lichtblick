// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type UndoRedoOptions<T> = {
  /**
   * Equality function used to determine whether the state has changed and should trigger the
   * previous state being pushed onto the undo stack.
   */
  isEqual: (a: T, b: T) => boolean;
  /**
   * Changes within a timespan less than throttleMs will be combined rather than separate items on
   * the undo stack. Defaults to infinite.
   */
  throttleMs?: number;
  /** At most this many changes will be kept on the stack. Defaults to infinite. */
  historySize?: number;
};

/**
 * Track changes in a state value, and provide functions to undo/redo those state changes.
 */
export default class UndoRedo<T> {
  currentState: T;
  undoStates: T[] = [];
  redoStates: T[] = [];
  isEqual: (a: T, b: T) => boolean;
  throttleMs?: number;
  historySize?: number;
  lastChangeTime = -Infinity;

  constructor(state: T, { isEqual, throttleMs, historySize }: UndoRedoOptions<T>) {
    this.currentState = state;
    this.isEqual = isEqual;
    this.throttleMs = throttleMs;
    this.historySize = historySize;
  }

  updateState(newState: T): void {
    if (!this.isEqual(newState, this.currentState)) {
      const now = Date.now();
      if (this.throttleMs == undefined || now - this.lastChangeTime >= this.throttleMs) {
        if (this.historySize != undefined) {
          this.undoStates.splice(0, this.undoStates.length - (this.historySize - 1));
        }
        this.undoStates.push(this.currentState);
        this.redoStates.splice(0); // remove all redo states when a change is made
      }
      this.currentState = newState;
      // Always update lastChangeTime in order to wait for continuous actions to finish.
      this.lastChangeTime = now;
    }
  }

  undo(setState: (_: T) => void): void {
    if (this.undoStates.length > 0) {
      const newState = this.undoStates.pop() as T;
      this.redoStates.push(this.currentState);
      this.currentState = newState;
      setState(newState);
    }
  }

  redo(setState: (_: T) => void): void {
    if (this.redoStates.length > 0) {
      const newState = this.redoStates.pop() as T;
      this.undoStates.push(this.currentState);
      this.currentState = newState;
      setState(newState);
    }
  }
}
