// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
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

    const readable = new BlobReadable(new Blob([tempBuffer.get()]) as unknown as globalThis.Blob);
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

    const readable = new BlobReadable(new Blob([tempBuffer.get()]) as unknown as globalThis.Blob);
    const decompressHandlers = await loadDecompressHandlers();
    const reader = await McapIndexedReader.Initialize({ readable, decompressHandlers });

    const source = new McapIndexedIterableSource(reader);

    const { metadata } = await source.initialize();

    expect(metadata).toBeDefined();
    expect(metadata).toEqual([]);
  });

  it("returns topicStats with numMessages and global start/end times separately", async () => {
    const tempBuffer = new TempBuffer();

    const writer = new McapWriter({
      writable: tempBuffer,
      startChannelId: 1,
      useStatistics: true, // Enable statistics so channelMessageCounts is populated
    });
    await writer.start({ library: "", profile: "" });
    await writer.registerSchema({
      data: new TextEncoder().encode("string data"),
      encoding: "ros1msg",
      name: "std_msgs/String",
    });
    await writer.registerChannel({
      messageEncoding: "ros1",
      schemaId: 1,
      metadata: new Map(),
      topic: "test",
    });
    // Add messages with specific timestamps
    await writer.addMessage({
      channelId: 1,
      data: new Uint8Array(),
      logTime: 1000000000n, // 1 second
      publishTime: 1000000000n,
      sequence: 1,
    });
    await writer.addMessage({
      channelId: 1,
      data: new Uint8Array(),
      logTime: 5000000000n, // 5 seconds
      publishTime: 5000000000n,
      sequence: 2,
    });
    await writer.end();

    const readable = new BlobReadable(new Blob([tempBuffer.get()]) as unknown as globalThis.Blob);
    const decompressHandlers = await loadDecompressHandlers();
    const reader = await McapIndexedReader.Initialize({ readable, decompressHandlers });

    const source = new McapIndexedIterableSource(reader);

    const { topicStats, start, end } = await source.initialize();

    expect(topicStats).toBeDefined();
    const testTopicStats = topicStats.get("test");
    expect(testTopicStats).toBeDefined();
    // topicStats only contains numMessages (MCAP footer doesn't have per-topic time boundaries)
    expect(testTopicStats?.numMessages).toBe(2);
    expect(testTopicStats?.firstMessageTime).toBeUndefined();
    expect(testTopicStats?.lastMessageTime).toBeUndefined();
    // Global start/end times are exposed separately via Initialization
    expect(start).toEqual({ sec: 1, nsec: 0 });
    expect(end).toEqual({ sec: 5, nsec: 0 });
  });
});
