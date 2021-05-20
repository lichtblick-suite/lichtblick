// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { act, renderHook } from "@testing-library/react-hooks";
import { useState, useRef, useCallback } from "react";

import useUndoRedo from "./useUndoRedo";

function setup<T>(initialValue: T, params: Parameters<typeof useUndoRedo>[2]) {
  return renderHook(() => {
    const [state, setState] = useState(initialValue);
    const internalSetStateCalls = useRef<T[]>([]);
    const { undo, redo } = useUndoRedo(
      state,
      useCallback((value) => {
        internalSetStateCalls.current.push(value);
        setState(value);
      }, []),
      params,
    );
    return {
      undo: () => act(() => undo()),
      redo: () => act(() => redo()),
      state,
      setState: (value: T) => act(() => setState(value)),
      internalSetStateCalls: internalSetStateCalls.current,
    };
  });
}

describe("useUndoRedo", () => {
  it("tracks history without duplicates", () => {
    const { result } = setup(0, { isEqual: Object.is });

    expect(result.current.internalSetStateCalls).toEqual([]);
    result.current.setState(1);
    result.current.setState(1);
    result.current.setState(2);
    expect(result.current.internalSetStateCalls).toEqual([]);

    result.current.undo();
    expect(result.current.internalSetStateCalls).toEqual([1]);

    result.current.redo();
    expect(result.current.internalSetStateCalls).toEqual([1, 2]);
    result.current.redo();
    expect(result.current.internalSetStateCalls).toEqual([1, 2]);

    result.current.undo();
    expect(result.current.internalSetStateCalls).toEqual([1, 2, 1]);
    result.current.undo();
    expect(result.current.internalSetStateCalls).toEqual([1, 2, 1, 0]);
    result.current.undo();
    expect(result.current.internalSetStateCalls).toEqual([1, 2, 1, 0]);

    result.current.redo();
    expect(result.current.internalSetStateCalls).toEqual([1, 2, 1, 0, 1]);
    result.current.redo();
    expect(result.current.internalSetStateCalls).toEqual([1, 2, 1, 0, 1, 2]);
    result.current.redo();
    expect(result.current.internalSetStateCalls).toEqual([1, 2, 1, 0, 1, 2]);
  });

  it("supports undefined values", () => {
    const { result } = setup<number | undefined>(undefined, { isEqual: Object.is });

    result.current.setState(1);
    result.current.setState(2);
    result.current.setState(undefined);
    result.current.setState(4);
    result.current.setState(5);
    result.current.undo();
    result.current.undo();
    result.current.undo();
    result.current.undo();
    result.current.undo();
    result.current.redo();
    result.current.redo();
    result.current.redo();
    result.current.redo();
    result.current.redo();
    expect(result.current.internalSetStateCalls).toEqual([
      4,
      undefined,
      2,
      1,
      undefined,
      1,
      2,
      undefined,
      4,
      5,
    ]);
  });

  it("clears redo state when doing a new action", () => {
    const { result } = setup(0, { isEqual: Object.is });

    result.current.setState(1);
    result.current.setState(2);
    result.current.setState(3);
    result.current.setState(4);
    result.current.undo();
    result.current.undo();
    expect(result.current.internalSetStateCalls).toEqual([3, 2]);

    result.current.setState(5);
    result.current.undo();
    expect(result.current.internalSetStateCalls).toEqual([3, 2, 2]);
    result.current.redo();
    expect(result.current.internalSetStateCalls).toEqual([3, 2, 2, 5]);
    result.current.redo();
    expect(result.current.internalSetStateCalls).toEqual([3, 2, 2, 5]);
  });

  it("limits history when historySize is passed", () => {
    const { result } = setup(0, { isEqual: Object.is, historySize: 2 });

    result.current.setState(1);
    result.current.setState(2);
    result.current.setState(3);
    result.current.setState(4);
    result.current.setState(5);
    result.current.undo();
    result.current.undo();
    result.current.undo();
    result.current.undo();
    result.current.undo();
    expect(result.current.internalSetStateCalls).toEqual([4, 3]);
  });

  it("doesn't use undo stack for changes within throttleMs", () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(0);
    const { result } = setup(0, { isEqual: Object.is, throttleMs: 10 });

    // these changes are too fast and are not added to the undo stack, but the latest value is kept
    // up to date
    for (let i = 1; i <= 20; i++) {
      now.mockReturnValue(i);
      result.current.setState(i);
    }

    // a gap of throttleMs should lead to the undo stack growing
    now.mockReturnValue(30);
    result.current.setState(30);
    now.mockReturnValue(31);
    result.current.setState(31);

    result.current.undo();
    result.current.undo();
    result.current.undo();
    result.current.undo();
    expect(result.current.internalSetStateCalls).toEqual([20, 0]);
    result.current.redo();
    result.current.redo();
    expect(result.current.internalSetStateCalls).toEqual([20, 0, 20, 31]);

    now.mockRestore();
  });
});
