// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RosMasterClient } from "./RosMasterClient";
import { GetDefaultRosMasterUri } from "./mock/PlatformMock";
import { XmlRpcCreateClient } from "./mock/XmlRpcMock";

describe("RosMasterClient", () => {
  it("can be instantiated and used", async () => {
    const url = await GetDefaultRosMasterUri();
    const xmlRpcClient = await XmlRpcCreateClient({ url });
    const rosMaster = new RosMasterClient({ xmlRpcClient });

    const [status, msg, value] = await rosMaster.getUri("");
    expect(status).toEqual(1);
    expect(typeof msg).toEqual("string");
    expect(value).toEqual("http://localhost:11311/");
  });
});
