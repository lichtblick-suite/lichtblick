// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapWriter } from "@mcap/core";
import { Blob } from "node:buffer";

import { TempBuffer } from "@foxglove/mcap-support";

import { McapIterableSource } from "./McapIterableSource";

describe("McapIterableSource", () => {
  it("returns an appropriate error message for an empty MCAP file", async () => {
    const tempBuffer = new TempBuffer();

    const writer = new McapWriter({ writable: tempBuffer });
    await writer.start({ library: "", profile: "" });
    await writer.end();

    const source = new McapIterableSource({ type: "file", file: new Blob([tempBuffer.get()]) });
    const { problems } = await source.initialize();
    expect(problems).toEqual([
      {
        message: "This file contains no messages.",
        severity: "warn",
      },
    ]);
  });
});
