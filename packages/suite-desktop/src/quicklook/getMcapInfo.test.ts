// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapWriter } from "@mcap/core";
import { Blob } from "node:buffer";

import { TempBuffer } from "@foxglove/mcap-support";

import { getMcapInfo } from "./getMcapInfo";

describe("getMcapInfo", () => {
  it("returns correct values for an empty MCAP file", async () => {
    const tempBuffer = new TempBuffer();

    const writer = new McapWriter({ writable: tempBuffer });
    await writer.start({ library: "", profile: "" });
    await writer.end();

    const result = await getMcapInfo(new Blob([tempBuffer.get()]) as globalThis.Blob);

    expect(result).toEqual({
      compressionTypes: new Set(),
      endTime: undefined,
      fileType: "MCAP v0, indexed",
      numAttachments: 0,
      numChunks: 0,
      startTime: undefined,
      topics: [],
      totalMessages: 0n,
    });
  });
});
