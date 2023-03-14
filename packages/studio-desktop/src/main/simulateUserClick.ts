// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { BrowserWindow } from "electron";

import delay from "@foxglove/studio-base/src/util/delay";

// <input> elements can only be opened on user interaction
// This fakes a uesr interaction which allows us to invoke input.click() in renderer threads
export async function simulateUserClick(win: BrowserWindow): Promise<void> {
  win.webContents.sendInputEvent({
    type: "mouseDown",
    x: -1,
    y: -1,
  });
  win.webContents.sendInputEvent({
    type: "mouseUp",
    x: -1,
    y: -1,
  });
  await delay(10);
}
