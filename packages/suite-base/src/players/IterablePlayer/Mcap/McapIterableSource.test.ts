// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapIndexedReader, McapWriter } from "@mcap/core";
import { Blob } from "node:buffer";

import { loadDecompressHandlers, TempBuffer } from "@lichtblick/mcap-support";
import PlayerBuilder from "@lichtblick/suite-base/testing/builders/PlayerBuilder";
import RosTimeBuilder from "@lichtblick/suite-base/testing/builders/RosTimeBuilder";
import { BasicBuilder } from "@lichtblick/test-builders";

import { McapIterableSource } from "./McapIterableSource";
import { RemoteFileReadable } from "./RemoteFileReadable";

jest.mock("./RemoteFileReadable");

const MockRemoteFileReadable = RemoteFileReadable as jest.MockedClass<typeof RemoteFileReadable>;

jest.mock("@lichtblick/mcap-support", () => ({
  ...jest.requireActual("@lichtblick/mcap-support"),
  loadDecompressHandlers: jest.fn(),
}));

// Helper function to add a message to the writer with customizable parameters
async function addMessage(
  writer: McapWriter,
  channelId: number,
  overrides: {
    sequence?: number;
    publishTime?: bigint;
    logTime?: bigint;
    data?: Uint8Array;
  } = {},
): Promise<void> {
  await writer.addMessage({
    channelId,
    sequence: overrides.sequence ?? 0,
    publishTime: overrides.publishTime ?? 0n,
    logTime: overrides.logTime ?? 1000000000n, // 1 second in nanoseconds
    data: overrides.data ?? new TextEncoder().encode(BasicBuilder.string()),
  });
}

async function createMcapFile({
  withMessage = true,
  topic = "/test",
  noChannels = false,
}: {
  withMessage?: boolean;
  topic?: string;
  noChannels?: boolean;
}): Promise<globalThis.Blob> {
  const tempBuffer = new TempBuffer();
  const writer = new McapWriter({ writable: tempBuffer });
  await writer.start({ library: "test", profile: "" });

  if (withMessage) {
    const schemaId = await writer.registerSchema({
      name: "test_schema",
      encoding: "jsonschema",
      data: new TextEncoder().encode(JSON.stringify({ type: "object" })),
    });
    if (!noChannels) {
      const channelId = await writer.registerChannel({
        schemaId,
        topic,
        messageEncoding: "json",
        metadata: new Map(),
      });
      await addMessage(writer, channelId);
    }
  }

  await writer.end();
  return new Blob([tempBuffer.get()]) as unknown as globalThis.Blob;
}

describe("McapIterableSource", () => {
  const mockLoadDecompressHandlers = loadDecompressHandlers as jest.MockedFunction<
    typeof loadDecompressHandlers
  >;

  beforeEach(() => {
    // Reset and setup mock to return actual decompression handlers
    mockLoadDecompressHandlers.mockReset();
    mockLoadDecompressHandlers.mockImplementation(() =>
      jest.requireActual("@lichtblick/mcap-support").loadDecompressHandlers(),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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

  it("loads decompression handlers before creating an indexed reader for an indexed file", async () => {
    // Given
    const topic = `/${BasicBuilder.string()}`;
    const file = await createMcapFile({ withMessage: true, topic });
    const source = new McapIterableSource({ type: "file", file });
    const readerInitializeSpy = jest.spyOn(McapIndexedReader, "Initialize");

    // When
    const result = await source.initialize();

    // Then
    expect(mockLoadDecompressHandlers).toHaveBeenCalledTimes(1);
    expect(readerInitializeSpy).toHaveBeenCalledTimes(1);

    // Verify loadDecompressHandlers was called before McapIndexedReader.Initialize
    const decompressHandlerCallOrder = mockLoadDecompressHandlers.mock.invocationCallOrder[0];
    const readerInitializeCallOrder = readerInitializeSpy.mock.invocationCallOrder[0];
    expect(decompressHandlerCallOrder).toBeLessThan(readerInitializeCallOrder!);

    // Verify initialization was successful
    expect(result.start).toBeDefined();
    expect(result.end).toBeDefined();
    expect(result.topics).toHaveLength(1);
    expect(result.topics[0]?.name).toBe(topic);
  });

  describe("When source type is URL", () => {
    const urlIndexedMcap = "https://example.com/data.mcap";
    const urlUnindexedMcap = "https://example.com/unindexed.mcap";

    function mockRemoteFileReadableWith(mcapData: Uint8Array): void {
      MockRemoteFileReadable.mockImplementation(() => {
        return {
          open: jest.fn().mockResolvedValue(undefined),
          size: jest.fn().mockResolvedValue(BigInt(mcapData.byteLength)),
          read: jest.fn().mockImplementation(async (offset: bigint, size: bigint) => {
            return new Uint8Array(
              mcapData.buffer,
              mcapData.byteOffset + Number(offset),
              Number(size),
            );
          }),
        } as unknown as RemoteFileReadable;
      });
    }

    async function buildIndexedMcap(
      messages: { logTime: bigint; publishTime?: bigint }[],
    ): Promise<Uint8Array> {
      const tempBuffer = new TempBuffer();
      const writer = new McapWriter({ writable: tempBuffer, startChannelId: 1 });
      await writer.start({ library: "", profile: "" });
      await writer.registerSchema({
        data: new Uint8Array(),
        encoding: BasicBuilder.string(),
        name: BasicBuilder.string(),
      });
      await writer.registerChannel({
        messageEncoding: BasicBuilder.string(),
        schemaId: 1,
        metadata: new Map(),
        topic: BasicBuilder.string(),
      });
      for (let i = 0; i < messages.length; i++) {
        await writer.addMessage({
          channelId: 1,
          data: new Uint8Array(),
          logTime: messages[i]!.logTime,
          publishTime: messages[i]!.publishTime ?? 0n,
          sequence: i + 1,
        });
      }
      await writer.end();
      return tempBuffer.get();
    }

    async function buildUnindexedMcap(
      messages: { logTime: bigint; publishTime?: bigint }[],
    ): Promise<Uint8Array> {
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
        topic: BasicBuilder.string(),
      });
      for (let i = 0; i < messages.length; i++) {
        await writer.addMessage({
          channelId: 1,
          data: new TextEncoder().encode("{}"),
          logTime: messages[i]!.logTime,
          publishTime: messages[i]!.publishTime ?? 0n,
          sequence: i + 1,
        });
      }
      await writer.end();
      return tempBuffer.get();
    }

    it("should create RemoteFileReadable with url and cacheSizeInBytes", async () => {
      // Given an indexed MCAP served via URL with a custom cache size
      const mcapData = await buildIndexedMcap([{ logTime: 1_000_000_000n }]);
      mockRemoteFileReadableWith(mcapData);
      const cacheSizeInBytes = 1024 * 1024 * 100;

      // When initializing a McapIterableSource with URL type
      const source = new McapIterableSource({
        type: "url",
        url: urlIndexedMcap,
        cacheSizeInBytes,
      });
      await source.initialize();

      // Then RemoteFileReadable should be constructed with the url and cache size
      expect(MockRemoteFileReadable).toHaveBeenCalledWith(urlIndexedMcap, cacheSizeInBytes);
    });

    it("should delegate getStart and getEnd to the underlying indexed source", async () => {
      // Given an indexed MCAP with messages from 2s to 8s served via URL
      const mcapData = await buildIndexedMcap([
        { logTime: 2_000_000_000n },
        { logTime: 8_000_000_000n },
      ]);
      mockRemoteFileReadableWith(mcapData);

      // When initializing the source
      const source = new McapIterableSource({ type: "url", url: urlIndexedMcap });
      await source.initialize();

      // Then getStart and getEnd should reflect the MCAP time range
      expect(source.getStart()).toEqual({ sec: 2, nsec: 0 });
      expect(source.getEnd()).toEqual({ sec: 8, nsec: 0 });
    });

    it("should fall back to unindexed source when indexed reading fails", async () => {
      // Given an unindexed MCAP with a message at 3s served via URL
      const mcapData = await buildUnindexedMcap([{ logTime: 3_000_000_000n }]);
      mockRemoteFileReadableWith(mcapData);
      const mockFetch = jest.fn().mockResolvedValue({
        body: new Blob([mcapData]).stream(),
        headers: new Headers({ "content-length": String(mcapData.byteLength) }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;

      // When initializing the source
      const source = new McapIterableSource({ type: "url", url: urlUnindexedMcap });
      const { alerts } = await source.initialize();

      // Then it should fall back to fetch for streaming
      expect(mockFetch).toHaveBeenCalledWith(urlUnindexedMcap);
      // And produce the unindexed performance warning
      expect(alerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "This file is unindexed. Unindexed files may have degraded performance.",
            severity: "warn",
          }),
        ]),
      );
      // And getStart/getEnd should reflect the message time
      expect(source.getStart()).toEqual({ sec: 3, nsec: 0 });
      expect(source.getEnd()).toEqual({ sec: 3, nsec: 0 });
    });

    it("should throw when fetch response has no body", async () => {
      // Given an unindexed MCAP served via URL where fetch returns no body
      const mcapData = await buildUnindexedMcap([{ logTime: 1_000_000_000n }]);
      mockRemoteFileReadableWith(mcapData);
      global.fetch = jest.fn().mockResolvedValue({
        body: undefined,
        headers: new Headers({ "content-length": String(mcapData.byteLength) }),
      }) as unknown as typeof fetch;

      // When initializing the source
      const source = new McapIterableSource({ type: "url", url: urlUnindexedMcap });

      // Then it should throw an error about missing body
      await expect(source.initialize()).rejects.toThrow(
        `Unable to stream remote file. <${urlUnindexedMcap}>`,
      );
    });

    it("should throw when fetch response has no Content-Length header", async () => {
      // Given an unindexed MCAP served via URL where fetch returns no Content-Length
      const mcapData = await buildUnindexedMcap([{ logTime: 1_000_000_000n }]);
      mockRemoteFileReadableWith(mcapData);
      global.fetch = jest.fn().mockResolvedValue({
        body: new Blob([mcapData]).stream(),
        headers: new Headers(),
      }) as unknown as typeof fetch;

      // When initializing the source
      const source = new McapIterableSource({ type: "url", url: urlUnindexedMcap });

      // Then it should throw an error about missing Content-Length
      await expect(source.initialize()).rejects.toThrow(
        `Remote file is missing Content-Length header. <${urlUnindexedMcap}>`,
      );
    });
  });

  describe("tryCreateIndexedReader", () => {
    it("uses preloaded decompressHandlers for indexed reader", async () => {
      // Given
      const file = await createMcapFile({ withMessage: true });
      const source = new McapIterableSource({ type: "file", file });

      // Spy on both loadDecompressHandlers and Initialize
      const loadHandlersSpy = jest.spyOn(
        await import("@lichtblick/mcap-support"),
        "loadDecompressHandlers",
      );
      const initializeSpy = jest.spyOn(McapIndexedReader, "Initialize");

      // When
      await source.initialize();

      // Then - verify the same handlers from loadDecompressHandlers are passed to Initialize
      expect(loadHandlersSpy).toHaveBeenCalledTimes(1);
      const loadedHandlers = await loadHandlersSpy.mock.results[0]!.value;

      expect(initializeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          decompressHandlers: loadedHandlers,
        }),
      );
    });

    it("successfully creates an indexed reader for a valid MCAP", async () => {
      // Given
      const topic = `/${BasicBuilder.string()}`;
      const file = await createMcapFile({ withMessage: true, topic });
      const source = new McapIterableSource({ type: "file", file });

      const initializeSpy = jest.spyOn(McapIndexedReader, "Initialize");

      // When
      const result = await source.initialize();

      // Then
      expect(initializeSpy).toHaveBeenCalledTimes(1);
      const reader = await initializeSpy.mock.results[0]!.value;

      expect(reader).toBeDefined();
      expect(reader.chunkIndexes.length).toBeGreaterThan(0);
      expect(reader.channelsById.size).toBeGreaterThan(0);

      expect(result).toBeDefined();
      expect(result.topics).toHaveLength(1);
      expect(result.topics[0]?.name).toBe(topic);
    });

    it("falls back to unindexed reader when MCAP has no chunks", async () => {
      // Given
      const file = await createMcapFile({ withMessage: false }); // No messages -> no chunks
      const source = new McapIterableSource({ type: "file", file });

      // When
      const result = await source.initialize();

      // Then
      expect(result).toBeDefined();
      expect(result.topics).toEqual([]);
    });

    it("falls back to unindexed reader when MCAP has no channels", async () => {
      // Given
      const file = await createMcapFile({ withMessage: true, noChannels: true });
      const source = new McapIterableSource({ type: "file", file });

      // When
      const result = await source.initialize();

      // Then
      expect(result).toBeDefined();
      expect(result.topics).toEqual([]);
    });

    it("falls back to unindexed reader when indexed reader initialization fails", async () => {
      // Given
      const file = await createMcapFile({ withMessage: true });
      const source = new McapIterableSource({ type: "file", file });

      const initializeSpy = jest
        .spyOn(McapIndexedReader, "Initialize")
        .mockRejectedValue(new Error("Corrupt MCAP file"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      // When
      const result = await source.initialize();

      // Then
      expect(result).toBeDefined();
      expect(result.topics).toHaveLength(1);
      expect(result.topics[0]?.name).toBe("/test");
      expect(initializeSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(new Error("Corrupt MCAP file"));
    });
  });

  describe("messageIterator", () => {
    it("should throw when source has not been initialized", () => {
      // Given a source that has not been initialized
      const source = new McapIterableSource({
        type: "file",
        file: new Blob([]) as unknown as globalThis.Blob,
      });

      // When calling messageIterator before initialize
      // Then it should throw
      expect(() => source.messageIterator({ topics: new Map() })).toThrow(
        "Invariant: uninitialized",
      );
    });

    it("should return an iterator from the underlying source after initialization", async () => {
      // Given an initialized source with a message
      const topic = BasicBuilder.string();
      const file = await createMcapFile({ withMessage: true, topic });
      const source = new McapIterableSource({ type: "file", file });
      await source.initialize();

      // When calling messageIterator with the topic
      const iterator = source.messageIterator({
        topics: new Map([[topic, PlayerBuilder.subscribePayload({ topic })]]),
      });

      // Then it should return an async iterator that yields message events
      const result = await iterator.next();
      expect(result.done).toBe(false);
      expect(result.value).toMatchObject({ type: "message-event" });
    });
  });

  describe("getBackfillMessages", () => {
    it("should throw when source has not been initialized", async () => {
      // Given a source that has not been initialized
      const source = new McapIterableSource({
        type: "file",
        file: new Blob([]) as unknown as globalThis.Blob,
      });

      // When calling getBackfillMessages before initialize
      // Then it should throw
      await expect(
        source.getBackfillMessages({
          topics: new Map(),
          time: RosTimeBuilder.time(),
        }),
      ).rejects.toThrow("Invariant: uninitialized");
    });

    it("should return backfill messages from the underlying source after initialization", async () => {
      // Given an initialized source with a message at 1s
      const topic = BasicBuilder.string();
      const file = await createMcapFile({ withMessage: true, topic });
      const source = new McapIterableSource({ type: "file", file });
      await source.initialize();

      // When calling getBackfillMessages at a time after the message
      const messages = await source.getBackfillMessages({
        topics: new Map([[topic, PlayerBuilder.subscribePayload({ topic })]]),
        time: RosTimeBuilder.time(),
      });

      // Then it should return the backfill message
      expect(messages).toHaveLength(1);
      expect(messages[0]!.topic).toBe(topic);
    });
  });
});
