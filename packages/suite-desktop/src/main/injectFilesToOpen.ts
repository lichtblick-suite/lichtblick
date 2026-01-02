// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { Debugger, dialog } from "electron";

import Logger from "@lichtblick/log";

const log = Logger.getLogger(__filename);

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
  debug: Debugger,
  filesToOpen: string[],
): Promise<void> {
  if (filesToOpen.length === 0) {
    log.debug("injectFilesToOpen: no files - skipping");
    return;
  }

  try {
    if (!debug.isAttached()) {
      debug.attach("1.1");
    }

    const documentRes = await debug.sendCommand("DOM.getDocument");
    const queryRes = await debug.sendCommand("DOM.querySelector", {
      nodeId: documentRes.root.nodeId,
      selector: `#${inputElementId}`,
    });
    await debug.sendCommand("DOM.setFileInputFiles", {
      nodeId: queryRes.nodeId,
      files: filesToOpen,
    });

    log.debug(`Set input files #${inputElementId}: \n${filesToOpen.join("\n")}`);

    // clear the files once we've opened them
    filesToOpen.splice(0, filesToOpen.length);
  } catch (err: unknown) {
    log.error(err);
    dialog.showErrorBox(
      "Internal error",
      `The app encountered an internal error trying to open: ${filesToOpen.join(",")}`,
    );
  } finally {
    debug.detach();
  }
}
