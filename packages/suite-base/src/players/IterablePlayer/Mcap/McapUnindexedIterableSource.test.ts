// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapWriter, TempBuffer } from "@mcap/core";
import { Blob } from "node:buffer";

import { McapUnindexedIterableSource } from "@lichtblick/suite-base/players/IterablePlayer/Mcap/McapUnindexedIterableSource";

describe("McapUnindexedIterableSource", () => {
  it("returns the correct metadata", async () => {
    const tempBuffer = new TempBuffer();

    const writer = new McapWriter({ writable: tempBuffer });
    await writer.start({ library: "", profile: "" });
    await writer.addMetadata({
      name: "metadata1",
      metadata: new Map(Object.entries({ key: "value" })),
    });
    await writer.end();

    const file = new Blob([tempBuffer.get()]);

    const source = new McapUnindexedIterableSource({
      size: file.size,
      stream: file.stream() as ReadableStream<Uint8Array>,
    });

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

    const writer = new McapWriter({ writable: tempBuffer });
    await writer.start({ library: "", profile: "" });
    await writer.end();

    const file = new Blob([tempBuffer.get()]);

    const source = new McapUnindexedIterableSource({
      size: file.size,
      stream: file.stream() as ReadableStream<Uint8Array>,
    });

    const { metadata } = await source.initialize();

    expect(metadata).toBeDefined();
    expect(metadata).toEqual([]);
  });

  describe("getStart and getEnd", () => {
    it("should return undefined before initialization", () => {
      // Given a source that has not been initialized
      const tempBuffer = new TempBuffer();
      const file = new Blob([tempBuffer.get()]);
      const source = new McapUnindexedIterableSource({
        size: file.size,
        stream: file.stream() as ReadableStream<Uint8Array>,
      });

      // When calling getStart and getEnd before initialize
      // Then both should return undefined
      expect(source.getStart()).toBeUndefined();
      expect(source.getEnd()).toBeUndefined();
    });

    it("should return correct start and end times after initialization with messages", async () => {
      // Given an MCAP file with messages at logTime 1s and 5s
      const tempBuffer = new TempBuffer();
      const writer = new McapWriter({
        writable: tempBuffer,
        startChannelId: 1,
        useChunks: false,
      });
      await writer.start({ library: "", profile: "" });
      await writer.registerChannel({
        messageEncoding: "json",
        schemaId: 0,
        metadata: new Map(),
        topic: "test",
      });
      await writer.addMessage({
        channelId: 1,
        data: new TextEncoder().encode("{}"),
        logTime: 5_000_000_000n, // 5 seconds
        publishTime: 0n,
        sequence: 1,
      });
      await writer.addMessage({
        channelId: 1,
        data: new TextEncoder().encode("{}"),
        logTime: 1_000_000_000n, // 1 second
        publishTime: 0n,
        sequence: 2,
      });
      await writer.end();

      const file = new Blob([tempBuffer.get()]);
      const source = new McapUnindexedIterableSource({
        size: file.size,
        stream: file.stream() as ReadableStream<Uint8Array>,
      });

      // When initializing
      await source.initialize();

      // Then getStart should return the earliest message time
      expect(source.getStart()).toEqual({ sec: 1, nsec: 0 });
      // And getEnd should return the latest message time
      expect(source.getEnd()).toEqual({ sec: 5, nsec: 0 });
    });
  });
});
