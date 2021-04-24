/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import fetchMock from "fetch-mock";

import { getRemoteBagGuid } from "./getRemoteBagGuid";

describe("getRemoteBagGuid", () => {
  it("uses the ETag from the remote url", async () => {
    fetchMock.get("http://example.org/bag", {
      headers: { "accept-ranges": "bytes", "content-length": 1234, etag: "my-etag" },
    });
    expect(await getRemoteBagGuid("http://example.org/bag")).toEqual(
      "http://example.org/bag---my-etag",
    );
    fetchMock.restore();
  });
});
