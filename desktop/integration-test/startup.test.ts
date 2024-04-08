// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { launchApp } from "./launchApp";

describe("startup", () => {
  it("should start the application", async () => {
    expect.assertions(0); // just needs to complete without error
    await using app = await launchApp();
    void app;
  }, 10_000);
});
