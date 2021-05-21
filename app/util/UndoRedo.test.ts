// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import UndoRedo from "./UndoRedo";

describe("UndoRedo", () => {
  it("tracks history without duplicates", () => {
    const state = new UndoRedo<number>(0, { isEqual: Object.is });
    const setState = jest
      .fn<void, [number]>()
      .mockImplementation((value) => state.updateState(value));

    expect(setState.mock.calls).toEqual([]);
    state.updateState(1);
    state.updateState(1);
    state.updateState(2);
    expect(setState.mock.calls).toEqual([]);

    state.undo(setState);
    expect(setState.mock.calls).toEqual([[1]]);

    state.redo(setState);
    expect(setState.mock.calls).toEqual([[1], [2]]);
    state.redo(setState);
    expect(setState.mock.calls).toEqual([[1], [2]]);

    state.undo(setState);
    expect(setState.mock.calls).toEqual([[1], [2], [1]]);
    state.undo(setState);
    expect(setState.mock.calls).toEqual([[1], [2], [1], [0]]);
    state.undo(setState);
    expect(setState.mock.calls).toEqual([[1], [2], [1], [0]]);

    state.redo(setState);
    expect(setState.mock.calls).toEqual([[1], [2], [1], [0], [1]]);
    state.redo(setState);
    expect(setState.mock.calls).toEqual([[1], [2], [1], [0], [1], [2]]);
    state.redo(setState);
    expect(setState.mock.calls).toEqual([[1], [2], [1], [0], [1], [2]]);
  });

  it("supports undefined values", () => {
    const state = new UndoRedo<number | undefined>(undefined, { isEqual: Object.is });
    const setState = jest
      .fn<void, [number | undefined]>()
      .mockImplementation((value) => state.updateState(value));

    state.updateState(1);
    state.updateState(2);
    state.updateState(undefined);
    state.updateState(4);
    state.updateState(5);
    state.undo(setState);
    state.undo(setState);
    state.undo(setState);
    state.undo(setState);
    state.undo(setState);
    state.redo(setState);
    state.redo(setState);
    state.redo(setState);
    state.redo(setState);
    state.redo(setState);
    expect(setState.mock.calls).toEqual([
      [4],
      [undefined],
      [2],
      [1],
      [undefined],
      [1],
      [2],
      [undefined],
      [4],
      [5],
    ]);
  });

  it("clears redo state when doing a new action", () => {
    const state = new UndoRedo<number>(0, { isEqual: Object.is });
    const setState = jest
      .fn<void, [number]>()
      .mockImplementation((value) => state.updateState(value));

    state.updateState(1);
    state.updateState(2);
    state.updateState(3);
    state.updateState(4);
    state.undo(setState);
    state.undo(setState);
    expect(setState.mock.calls).toEqual([[3], [2]]);

    state.updateState(5);
    state.undo(setState);
    expect(setState.mock.calls).toEqual([[3], [2], [2]]);
    state.redo(setState);
    expect(setState.mock.calls).toEqual([[3], [2], [2], [5]]);
    state.redo(setState);
    expect(setState.mock.calls).toEqual([[3], [2], [2], [5]]);
  });

  it("limits history when historySize is passed", () => {
    const state = new UndoRedo<number>(0, { isEqual: Object.is, historySize: 2 });
    const setState = jest
      .fn<void, [number]>()
      .mockImplementation((value) => state.updateState(value));

    state.updateState(1);
    state.updateState(2);
    state.updateState(3);
    state.updateState(4);
    state.updateState(5);
    state.undo(setState);
    state.undo(setState);
    state.undo(setState);
    state.undo(setState);
    state.undo(setState);
    expect(setState.mock.calls).toEqual([[4], [3]]);
  });

  it("doesn't use undo stack for changes within throttleMs", () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(0);
    const state = new UndoRedo<number>(0, { isEqual: Object.is, throttleMs: 10 });
    const setState = jest
      .fn<void, [number]>()
      .mockImplementation((value) => state.updateState(value));

    // these changes are too fast and are not added to the undo stack, but the latest value is kept
    // up to date
    for (let i = 1; i <= 20; i++) {
      now.mockReturnValue(i);
      state.updateState(i);
    }

    // a gap of throttleMs should lead to the undo stack growing
    now.mockReturnValue(30);
    state.updateState(30);
    now.mockReturnValue(31);
    state.updateState(31);

    state.undo(setState);
    state.undo(setState);
    state.undo(setState);
    state.undo(setState);
    expect(setState.mock.calls).toEqual([[20], [0]]);
    state.redo(setState);
    state.redo(setState);
    expect(setState.mock.calls).toEqual([[20], [0], [20], [31]]);

    now.mockRestore();
  });
});
