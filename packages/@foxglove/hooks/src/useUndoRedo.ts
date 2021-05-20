// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useLayoutEffect, useRef, useMemo } from "react";

type Options<T> = {
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
 * @param currentState The current value of the state.
 * @param setState A function to call with the new state when undo() or redo() is called.
 */
export default function useUndoRedo<T>(
  currentState: T,
  setState: (state: T) => void,
  { isEqual, throttleMs, historySize }: Options<T>,
): { undo: () => void; redo: () => void } {
  const ref = useRef({
    currentState,
    lastChangeTime: -Infinity,
    undoStates: [] as T[],
    redoStates: [] as T[],
  });

  useLayoutEffect(() => {
    if (!isEqual(currentState, ref.current.currentState)) {
      const now = Date.now();
      if (throttleMs == undefined || now - ref.current.lastChangeTime >= throttleMs) {
        if (historySize != undefined) {
          ref.current.undoStates.splice(0, ref.current.undoStates.length - (historySize - 1));
        }
        ref.current.undoStates.push(ref.current.currentState);
        ref.current.redoStates.splice(0); // remove all redo states when a change is made
      }
      ref.current.currentState = currentState;
      // Always update lastChangeTime in order to wait for continuous actions to finish.
      ref.current.lastChangeTime = now;
    }
  }, [currentState, historySize, isEqual, throttleMs]);

  const undo = useCallback(() => {
    if (ref.current.undoStates.length > 0) {
      const newState = ref.current.undoStates.pop() as T;
      ref.current.redoStates.push(ref.current.currentState);
      ref.current.currentState = newState;
      setState(newState);
    }
  }, [setState]);

  const redo = useCallback(() => {
    if (ref.current.redoStates.length > 0) {
      const newState = ref.current.redoStates.pop() as T;
      ref.current.undoStates.push(ref.current.currentState);
      ref.current.currentState = newState;
      setState(newState);
    }
  }, [setState]);

  return useMemo(() => ({ undo, redo }), [undo, redo]);
}
