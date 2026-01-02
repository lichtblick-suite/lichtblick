// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapWriter } from "@mcap/core";
import { Blob } from "node:buffer";

import { TempBuffer } from "@lichtblick/mcap-support";

import { McapIterableSource } from "./McapIterableSource";

describe("McapIterableSource", () => {
  it("returns an appropriate error message for an empty MCAP file", async () => {
    const tempBuffer = new TempBuffer();

    const writer = new McapWriter({ writable: tempBuffer });
    await writer.start({ library: "", profile: "" });
    await writer.end();

    const source = new McapIterableSource({
      type: "file",
      // the global Blob definition exists in type definitions, but the constructor is
      // not available at runtime. We use node:buffer's Blob to test here, but the
      // type is technically not compatible with the global Blob type, so we cast
      // to get around this.
      file: new Blob([tempBuffer.get()]) as unknown as globalThis.Blob,
    });
    const { alerts } = await source.initialize();
    expect(alerts).toEqual([
      {
        message: "This file contains no messages.",
        severity: "warn",
      },
    ]);
  });
});
