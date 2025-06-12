// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapIndexedReader, McapWriter, TempBuffer } from "@mcap/core";
import { Blob } from "node:buffer";

import { loadDecompressHandlers } from "@lichtblick/mcap-support";
import { BlobReadable } from "@lichtblick/suite-base/players/IterablePlayer/Mcap/BlobReadable";
import { McapIndexedIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/Mcap/McapIndexedIterableSource";

describe("McapIndexedIterableSource", () => {
  it("returns the correct metadata", async () => {
    const tempBuffer = new TempBuffer();

    const writer = new McapWriter({ writable: tempBuffer, startChannelId: 1 });
    await writer.start({ library: "", profile: "" });
    await writer.registerSchema({
      data: new Uint8Array(),
      encoding: "test",
      name: "test",
    });
    await writer.registerChannel({
      messageEncoding: "1",
      schemaId: 1,
      metadata: new Map(),
      topic: "test",
    });
    await writer.addMessage({
      channelId: 1,
      data: new Uint8Array(),
      logTime: 0n,
      publishTime: 0n,
      sequence: 1,
    });
    await writer.addMetadata({
      name: "metadata1",
      metadata: new Map(Object.entries({ key: "value" })),
    });
    await writer.end();

    const readable = new BlobReadable(new Blob([tempBuffer.get()]));
    const decompressHandlers = await loadDecompressHandlers();
    const reader = await McapIndexedReader.Initialize({ readable, decompressHandlers });

    const source = new McapIndexedIterableSource(reader);

    const { metadata } = await source.initialize();

    expect(metadata).toBeDefined();
    expect(metadata).toEqual([
      {
        name: "metadata1",
        metadata: { key: "value" },
      },
    ]);
  });

  it("returns an empty array when no metadata is on the file", async () => {
    const tempBuffer = new TempBuffer();

    const writer = new McapWriter({ writable: tempBuffer, startChannelId: 1 });
    await writer.start({ library: "", profile: "" });
    await writer.registerSchema({
      data: new Uint8Array(),
      encoding: "test",
      name: "test",
    });
    await writer.registerChannel({
      messageEncoding: "1",
      schemaId: 1,
      metadata: new Map(),
      topic: "test",
    });
    await writer.addMessage({
      channelId: 1,
      data: new Uint8Array(),
      logTime: 0n,
      publishTime: 0n,
      sequence: 1,
    });
    await writer.end();

    const readable = new BlobReadable(new Blob([tempBuffer.get()]));
    const decompressHandlers = await loadDecompressHandlers();
    const reader = await McapIndexedReader.Initialize({ readable, decompressHandlers });

    const source = new McapIndexedIterableSource(reader);

    const { metadata } = await source.initialize();

    expect(metadata).toBeDefined();
    expect(metadata).toEqual([]);
  });
});
