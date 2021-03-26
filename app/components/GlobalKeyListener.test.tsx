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
import { createMemoryHistory } from "history";

import * as layoutHistoryActions from "@foxglove-studio/app/actions/layoutHistory";
import GlobalKeyListener from "@foxglove-studio/app/components/GlobalKeyListener";
import MockMessagePipelineProvider from "@foxglove-studio/app/components/MessagePipeline/MockMessagePipelineProvider";
import createRootReducer from "@foxglove-studio/app/reducers";
import configureStore from "@foxglove-studio/app/store/configureStore.testing";

function getStore() {
  return configureStore(createRootReducer(createMemoryHistory()));
}

function Context(props: any) {
  return (
    <MockMessagePipelineProvider store={props.store}> {props.children}</MockMessagePipelineProvider>
  );
}
describe("GlobalKeyListener", () => {
  let redoActionCreator: any;
  let undoActionCreator: any;

  beforeEach(() => {
    redoActionCreator = jest.spyOn(layoutHistoryActions, "redoLayoutChange");
    undoActionCreator = jest.spyOn(layoutHistoryActions, "undoLayoutChange");
    const wrapper = document.createElement("div");
    document.body.appendChild(wrapper);
    mount(
      <Context store={getStore()}>
        <div data-nativeundoredo="true">
          <textarea id="some-text-area" />
        </div>
        <GlobalKeyListener />
        <textarea id="other-text-area" />
      </Context>,
      { attachTo: wrapper },
    );
  });

  it("fires undo events", () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
    expect(redoActionCreator).not.toHaveBeenCalled();
    expect(undoActionCreator).toHaveBeenCalledTimes(1);
  });

  it("fires redo events", () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true }),
    );
    expect(redoActionCreator).toHaveBeenCalledTimes(1);
    expect(undoActionCreator).not.toHaveBeenCalled();
  });

  it("does not fire undo/redo events from editable fields", () => {
    const shareTextarea = document.getElementById("some-text-area");
    if (shareTextarea == undefined) {
      throw new Error("could not find shareTextArea.");
    }
    shareTextarea.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }),
    );
    expect(undoActionCreator).not.toHaveBeenCalled();
    expect(redoActionCreator).not.toHaveBeenCalled();

    // Check that it does fire in a different text area.
    const otherTextarea = document.getElementById("other-text-area");
    if (!otherTextarea) {
      throw new Error("could not find otherTextArea.");
    }
    otherTextarea.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }),
    );
    expect(undoActionCreator).not.toHaveBeenCalled();
    expect(redoActionCreator).not.toHaveBeenCalled();
  });
});
