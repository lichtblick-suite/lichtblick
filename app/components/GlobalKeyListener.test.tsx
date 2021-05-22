/** @jest-environment jsdom */
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

import { mount } from "enzyme";

import GlobalKeyListener from "@foxglove/studio-base/components/GlobalKeyListener";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import CurrentLayoutContext from "@foxglove/studio-base/context/CurrentLayoutContext";
import CurrentLayoutState, {
  DEFAULT_LAYOUT_FOR_TESTS,
} from "@foxglove/studio-base/providers/CurrentLayoutProvider/CurrentLayoutState";

describe("GlobalKeyListener", () => {
  let undoSpy: jest.SpyInstance | undefined;
  let redoSpy: jest.SpyInstance | undefined;
  let unmount: (() => void) | undefined;

  beforeEach(() => {
    const mockContext = new CurrentLayoutState(DEFAULT_LAYOUT_FOR_TESTS);
    undoSpy = jest.spyOn(mockContext.actions, "undoLayoutChange");
    redoSpy = jest.spyOn(mockContext.actions, "redoLayoutChange");

    const wrapper = document.createElement("div");
    document.body.appendChild(wrapper);
    const root = mount(
      <CurrentLayoutContext.Provider value={mockContext}>
        <MockMessagePipelineProvider>
          <div data-nativeundoredo="true">
            <textarea id="some-text-area" />
          </div>
          <GlobalKeyListener />
          <textarea id="other-text-area" />
        </MockMessagePipelineProvider>
      </CurrentLayoutContext.Provider>,
      { attachTo: wrapper },
    );
    unmount = () => root.unmount();
  });
  afterEach(() => {
    unmount?.();
  });

  it("fires undo events", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
    expect(redoSpy).not.toHaveBeenCalled();
    expect(undoSpy).toHaveBeenCalledTimes(1);
  });

  it("fires redo events", () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true }),
    );
    expect(redoSpy).toHaveBeenCalledTimes(1);
    expect(undoSpy).not.toHaveBeenCalled();
  });

  it("does not fire undo/redo events from editable fields", () => {
    const shareTextarea = document.getElementById("some-text-area");
    if (shareTextarea == undefined) {
      throw new Error("could not find shareTextArea.");
    }
    shareTextarea.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }),
    );
    expect(undoSpy).not.toHaveBeenCalled();
    expect(redoSpy).not.toHaveBeenCalled();

    // Check that it does fire in a different text area.
    const otherTextarea = document.getElementById("other-text-area");
    if (!otherTextarea) {
      throw new Error("could not find otherTextArea.");
    }
    otherTextarea.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }),
    );
    expect(undoSpy).not.toHaveBeenCalled();
    expect(redoSpy).not.toHaveBeenCalled();
  });
});
