// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { mutateClient, initClient } from "./state";
import { createState, CLIENT_ID, FAKE_PATH } from "./testing";

describe("mutateClient", () => {
  it("ignores unrelated client", () => {
    const before = createState();
    const after = mutateClient(before, "test", initClient("test", undefined));
    expect(after.clients[0]).toEqual(before.clients[0]);
  });

  it("updates a client", () => {
    const before = createState(FAKE_PATH);
    const client = initClient(CLIENT_ID, undefined);
    const after = mutateClient(before, CLIENT_ID, client);
    expect(after.clients[0]).toEqual(client);
  });
});
