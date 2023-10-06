// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { getPathData } from "./accumulate";
import { receiveMetadata } from "./messages";
import { createState, createPath, FAKE_TOPICS, FAKE_PATH, FAKE_DATATYPES } from "./testing";

describe("getPathData", () => {
  it("ignores invalid path", () => {
    const before = receiveMetadata(FAKE_TOPICS, FAKE_DATATYPES, createState(FAKE_PATH));
    const pathData = getPathData(before.metadata, {}, {}, createPath("你好"));
    expect(pathData).toEqual([]);
  });
});
