// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Condvar } from "./Condvar";

describe("Condvar", () => {
  it("should notifyAll waiting", async () => {
    const condvar = new Condvar();

    const wait1 = condvar.wait();
    const wait2 = condvar.wait();

    const start = Date.now();
    setTimeout(() => {
      condvar.notifyAll();
    }, 500);

    await wait1;
    await wait2;
    expect(Date.now() - start).toBeGreaterThan(480);
  });

  it("should notifyOne waiting", async () => {
    const condvar = new Condvar();

    const wait1 = condvar.wait();
    const wait2 = condvar.wait();

    condvar.notifyOne();
    await wait1;

    // Notify another after 500 milliseconds and verify 500 milliseconds time passed
    const start = Date.now();
    setTimeout(() => {
      condvar.notifyOne();
    }, 500);

    await wait2;
    expect(Date.now() - start).toBeGreaterThan(480);
  });
});
