// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { chromium } from "playwright";

import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

describe("startup", () => {
  it("should start the application", async () => {
    expect.assertions(0); // just needs to complete without error
    if (typeof process.env.BASE_URL === "string") {
      const browser = await chromium.launch();
      const page = await browser.newPage();
      await page.goto(process.env.BASE_URL);

      await new Promise<void>((resolve, reject) => {
        page.on("console", (message) => {
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

      await browser.close();
    } else {
      throw new Error("BASE_URL is not set");
    }
  }, 15_000);
});
