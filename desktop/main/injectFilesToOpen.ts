// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { BrowserWindow } from "electron";

/*
 * Our app has support for working with File instances in the renderer. This avoids extra copies
 * while reading files and lets the renderer seek/read as necessary using all the browser
 * primitives for File instances.
 *
 * Unfortunately Electron does not provide a way to create or send File instances to the renderer.
 * To avoid sending the data over our context bridge, we use a hack.
 * Via the debugger we inject a DOM event to set the files of an <input> element.
 */
const inputElementId = "electron-open-file-input";
export default async function injectFilesToOpen(
  browserWindow: BrowserWindow,
  filesToOpen: string[],
): Promise<void> {
  const debug = browserWindow.webContents.debugger;
  try {
    debug.attach("1.1");
  } catch (err) {
    // debugger may already be attached
  }

  try {
    const documentRes = await debug.sendCommand("DOM.getDocument");
    const queryRes = await debug.sendCommand("DOM.querySelector", {
      nodeId: documentRes.root.nodeId,
      selector: `#${inputElementId}`,
    });
    await debug.sendCommand("DOM.setFileInputFiles", {
      nodeId: queryRes.nodeId,
      files: filesToOpen,
    });

    // clear the files once we've opened them
    filesToOpen.splice(0, filesToOpen.length);
  } finally {
    debug.detach();
  }
}
