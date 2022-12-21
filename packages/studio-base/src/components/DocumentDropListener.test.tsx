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

import { SnackbarProvider } from "notistack";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";

import DocumentDropListener from "@foxglove/studio-base/components/DocumentDropListener";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

describe("<DocumentDropListener>", () => {
  let wrapper: HTMLDivElement;
  let windowDragoverHandler: typeof jest.fn;

  beforeEach(() => {
    windowDragoverHandler = jest.fn();
    window.addEventListener("dragover", windowDragoverHandler);

    wrapper = document.createElement("div");
    document.body.appendChild(wrapper);

    createRoot(wrapper).render(
      <div>
        <SnackbarProvider>
          <ThemeProvider isDark={false}>
            <DocumentDropListener allowedExtensions={[]} />
          </ThemeProvider>
        </SnackbarProvider>
      </div>,
    );
  });

  it("allows the event to bubble if the dataTransfer has no files", async () => {
    // The event should bubble up from the document to the window
    await act(() => {
      document.dispatchEvent(new CustomEvent("dragover", { bubbles: true, cancelable: true }));
    });
    expect(windowDragoverHandler).toHaveBeenCalled();
  });

  it("prevents the event from bubbling if the dataTransfer contains Files", async () => {
    // DragEvent is not defined in jsdom at the moment, so simulate one using a MouseEvent
    const event = new MouseEvent("dragover", {
      bubbles: true,
      cancelable: true,
    });
    (event as any).dataTransfer = {
      types: ["Files"],
    };
    document.dispatchEvent(event); // The event should NOT bubble up from the document to the window
    expect(windowDragoverHandler).not.toHaveBeenCalled();
  });

  afterEach(() => {
    document.body.removeChild(wrapper);
    window.removeEventListener("dragover", windowDragoverHandler);
  });
});
