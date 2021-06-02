// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import electron from "electron";
import path from "path";
import { Application } from "spectron";

jest.setTimeout(10000);

// In node.js the electron import gives us the path to the electron binary
// Our type definitions don't realize this so cast the variable to a string
const electronPath = electron as unknown as string;
const appPath = path.join(__dirname, "..", ".webpack");

const app = new Application({
  path: electronPath,
  args: [appPath],
});

beforeAll(async () => {
  await app.start();
});

afterAll(async () => {
  if (!app.isRunning()) {
    return;
  }

  await app.stop();
  expect(app.isRunning()).toBe(false);
});

async function waitForAppMounted(appInstance: Application) {
  if (appInstance.client === undefined) {
    throw new Error("App did not start");
  }

  for (;;) {
    const logs = await appInstance.client.getRenderProcessLogs();
    for (const log of logs as { level: "INFO" | "SEVERE" | "WARNING"; message?: string }[]) {
      if (log.level === "SEVERE") {
        throw new Error(log.message);
      }
      const message = log.message;
      if (typeof message === "string" && message.includes("App rendered")) {
        return;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// App startup tests are not working in our CI environment (even with ubuntu xvfb)
// They stopped working around June 2nd 2021.
// The error we are seeing is that Chrome failed to start (i.e. the app didn't start)
// eslint-disable-next-line jest/no-disabled-tests
it.skip("should start with no errors", async () => {
  await waitForAppMounted(app);
});
