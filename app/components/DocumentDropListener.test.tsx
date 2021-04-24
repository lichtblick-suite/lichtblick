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

import { noop } from "lodash";
import ReactDOM from "react-dom";

import DocumentDropListener from "@foxglove-studio/app/components/DocumentDropListener";

describe("<DocumentDropListener>", () => {
  let wrapper: any;
  let windowDragoverHandler: any;

  beforeEach(() => {
    windowDragoverHandler = jest.fn();
    window.addEventListener("dragover", windowDragoverHandler);

    wrapper = document.createElement("div");
    document.body?.appendChild(wrapper);

    ReactDOM.render(
      <div>
        <DocumentDropListener filesSelected={noop}>
          <div />
        </DocumentDropListener>
      </div>,
      wrapper,
    );
  });

  it("allows the event to bubble if the dataTransfer has no files", async () => {
    // The event should bubble up from the document to the window
    document.dispatchEvent(new CustomEvent("dragover", { bubbles: true, cancelable: true }));
    expect(windowDragoverHandler).toHaveBeenCalled();
  });

  it("prevents the event from bubbling if the dataTransfer contains Files", async () => {
    // DragEvent is not defined in jsdom at the moment, so simulate one using a MouseEvent
    const event: any = new MouseEvent("dragover", {
      bubbles: true,
      cancelable: true,
    });
    event.dataTransfer = {
      types: ["Files"],
    };
    document.dispatchEvent(event); // The event should NOT bubble up from the document to the window
    expect(windowDragoverHandler).not.toHaveBeenCalled();
  });

  afterEach(() => {
    document.body?.removeChild(wrapper);
    window.removeEventListener("dragover", windowDragoverHandler);
  });
});
