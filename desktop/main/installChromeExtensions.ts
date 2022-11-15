// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import installExtension, { REACT_DEVELOPER_TOOLS } from "electron-devtools-installer";

import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

export default async function installChromeExtensions(): Promise<void> {
  log.info("Installing Chrome extensions for development...");
  // Extension installation sometimes gets stuck between the download step and the extension loading step, for unknown reasons.
  // So don't wait indefinitely for installation to complete.
  let finished = false;
  await Promise.race([
    Promise.allSettled([installExtension(REACT_DEVELOPER_TOOLS)]).then((results) => {
      finished = true;
      log.info("Finished:", results);
    }),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        if (!finished) {
          console.warn(
            "Warning: extension installation may be stuck; try relaunching electron or deleting its extensions directory. Continuing for now.",
          );
        }
        resolve();
      }, 5000);
    }),
  ]);
}
