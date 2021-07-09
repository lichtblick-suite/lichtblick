// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import electronPath from "electron";
import { _electron as electron } from "playwright";

import Logger from "@foxglove/log";

import { appPath } from "./build";

const log = Logger.getLogger(__filename);

describe("startup", () => {
  it("should start the application", async () => {
    expect.assertions(0); // just needs to complete without error
    // In node.js the electron import gives us the path to the electron binary
    // Our type definitions don't realize this so cast the variable to a string
    const electronApp = await electron.launch({
      args: [appPath],
      executablePath: electronPath as unknown as string,
    });

    // Get the first window that the app opens, wait if necessary.
    const electronWindow = await electronApp.firstWindow();

    // Direct Electron console to Node terminal.
    await new Promise<void>((resolve, reject) => {
      electronWindow.on("console", (message) => {
        if (message.type() === "error") {
          reject(new Error(message.text()));
          return;
        }
        log.info(message.text());

        if (message.text().includes("App rendered")) {
          resolve();
        }
      });
    });

    await electronApp.close();
  }, 10_000);
});
