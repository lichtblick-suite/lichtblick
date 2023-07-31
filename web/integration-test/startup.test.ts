// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import http from "http";
import path from "path";
import { chromium } from "playwright";
import serveHandler from "serve-handler";

import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

describe("startup", () => {
  it("should start the application", async () => {
    expect.assertions(0); // just needs to complete without error

    const publicPath = path.join(__dirname, "..", ".webpack");

    const server = http.createServer(async (request, response) => {
      return await serveHandler(request, response, {
        public: publicPath,
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });

    const port = (server.address() as any).port;
    const url = `http://localhost:${port}`;

    // eslint-disable-next-line no-restricted-syntax
    console.info(`Running at ${url}`);

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(url);

    try {
      await new Promise<void>((resolve, reject) => {
        page.on("console", (message) => {
          if (message.type() === "error") {
            reject(new Error(message.text()));
            return;
          }
          log.info(message.text());

          if (message.text().includes("App rendered")) {
            // Wait for a few seconds for the app to render more components and detect if
            // there are any errors after the initial app render
            setTimeout(resolve, 2_000);
          }
        });
      });
    } finally {
      await browser.close();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  }, 15_000);
});
