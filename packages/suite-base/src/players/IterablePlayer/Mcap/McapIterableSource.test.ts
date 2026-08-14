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
import { HydratedSourcePool } from "../shared/HydratedSourcePool";

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
    MockRemoteFileReadable.mockReset();
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

    type MockRemoteReadable = {
      open: jest.Mock<Promise<void>, []>;
      close: jest.Mock<void, []>;
      size: jest.Mock<Promise<bigint>, []>;
      read: jest.Mock<Promise<Uint8Array>, [bigint, bigint]>;
    };

    function mockRemoteFileReadableWith(
      mcapDataOrByUrl: Uint8Array | Record<string, Uint8Array>,
    ): Map<string, MockRemoteReadable[]> {
      const instancesByUrl = new Map<string, MockRemoteReadable[]>();
      MockRemoteFileReadable.mockImplementation((url: string) => {
        const mcapData =
          mcapDataOrByUrl instanceof Uint8Array ? mcapDataOrByUrl : mcapDataOrByUrl[url]!;
        const instance: MockRemoteReadable = {
          open: jest.fn().mockResolvedValue(undefined),
          close: jest.fn(),
          size: jest.fn().mockResolvedValue(BigInt(mcapData.byteLength)),
          read: jest.fn().mockImplementation(async (offset: bigint, size: bigint) => {
            return new Uint8Array(
              mcapData.buffer,
              mcapData.byteOffset + Number(offset),
              Number(size),
            );
          }),
        };
        const instances = instancesByUrl.get(url) ?? [];
        instances.push(instance);
        instancesByUrl.set(url, instances);
        return instance as unknown as RemoteFileReadable;
      });
      return instancesByUrl;
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

    it("should create RemoteFileReadable with url, cacheSizeInBytes, and readAheadEnabled", async () => {
      // Given an indexed MCAP served via URL with a custom cache size
      const mcapData = await buildIndexedMcap([{ logTime: 1_000_000_000n }]);
      mockRemoteFileReadableWith(mcapData);
      const cacheSizeInBytes = 1024 * 1024 * 100;
      const readAheadEnabled = false;

      // When initializing a McapIterableSource with URL type
      const source = new McapIterableSource({
        type: "url",
        url: urlIndexedMcap,
        cacheSizeInBytes,
        readAheadEnabled,
      });
      await source.initialize();

      // Then RemoteFileReadable should be constructed with the URL options
      expect(MockRemoteFileReadable).toHaveBeenCalledWith(urlIndexedMcap, {
        cacheSizeInBytes,
        readAheadEnabled,
      });
    });

    it("should forward readAheadBufferBytes to RemoteFileReadable when provided", async () => {
      // Given an indexed MCAP served via URL with a bounded read-ahead override
      const mcapData = await buildIndexedMcap([{ logTime: 1_000_000_000n }]);
      mockRemoteFileReadableWith(mcapData);
      const readAheadBufferBytes = 2 * 1024 * 1024;

      // When initializing a McapIterableSource with URL type
      const source = new McapIterableSource({
        type: "url",
        url: urlIndexedMcap,
        readAheadBufferBytes,
      });
      await source.initialize();

      // Then RemoteFileReadable should receive the bounded read-ahead override
      expect(MockRemoteFileReadable).toHaveBeenCalledWith(
        urlIndexedMcap,
        expect.objectContaining({ readAheadBufferBytes }),
      );
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
      global.fetch = mockFetch;

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
      });

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
      });

      // When initializing the source
      const source = new McapIterableSource({ type: "url", url: urlUnindexedMcap });

      // Then it should throw an error about missing Content-Length
      await expect(source.initialize()).rejects.toThrow(
        `Remote file is missing Content-Length header. <${urlUnindexedMcap}>`,
      );
    });

    describe("with a bounded HydratedSourcePool", () => {
      // Build an indexed MCAP with a known topic and valid json encoding so init.topics is
      // populated and messages can be subscribed/iterated by name.
      async function buildIndexedMcapWithTopic(
        topic: string,
        logTimes: bigint[],
      ): Promise<Uint8Array> {
        const tempBuffer = new TempBuffer();
        const writer = new McapWriter({ writable: tempBuffer, startChannelId: 1 });
        await writer.start({ library: "", profile: "" });
        const schemaId = await writer.registerSchema({
          name: "test_schema",
          encoding: "jsonschema",
          data: new TextEncoder().encode(JSON.stringify({ type: "object" })),
        });
        await writer.registerChannel({
          messageEncoding: "json",
          schemaId,
          metadata: new Map(),
          topic,
        });
        for (let i = 0; i < logTimes.length; i++) {
          await writer.addMessage({
            channelId: 1,
            data: new TextEncoder().encode("{}"),
            logTime: logTimes[i]!,
            publishTime: 0n,
            sequence: i + 1,
          });
        }
        await writer.end();
        return tempBuffer.get();
      }

      it("reuses the same RemoteFileReadable across eviction while re-running indexed initialization on re-hydration", async () => {
        // Given two indexed MCAPs served via URL that share a capacity-1 pool
        const topic = "/pooled_topic";
        const urlIndexedMcapA = "https://example.com/data-a.mcap";
        const urlIndexedMcapB = "https://example.com/data-b.mcap";
        const mcapData = await buildIndexedMcapWithTopic(topic, [1_000_000_000n]);
        const readableInstancesByUrl = mockRemoteFileReadableWith({
          [urlIndexedMcapA]: mcapData,
          [urlIndexedMcapB]: mcapData,
        });
        const pool = new HydratedSourcePool({ maxCount: 1 });
        const sourceA = new McapIterableSource({ type: "url", url: urlIndexedMcapA, pool });
        const sourceB = new McapIterableSource({ type: "url", url: urlIndexedMcapB, pool });
        const readerInitializeSpy = jest.spyOn(McapIndexedReader, "Initialize");

        // When initializing A and iterating it while still resident
        await sourceA.initialize();
        const initialIterator = sourceA.messageIterator({
          topics: new Map([[topic, PlayerBuilder.subscribePayload({ topic })]]),
        });
        const initialResult = await initialIterator.next();
        await initialIterator.next();

        // Then A created exactly one remote readable and one indexed reader so far
        expect(initialResult.value).toMatchObject({ type: "message-event" });
        const sourceAReadable = readableInstancesByUrl.get(urlIndexedMcapA)?.[0];
        expect(sourceAReadable).toBeDefined();
        expect(sourceAReadable?.open).toHaveBeenCalledTimes(1);
        expect(
          readerInitializeSpy.mock.calls.filter(([arg]) => arg.readable === sourceAReadable),
        ).toHaveLength(1);

        // When B initializes, A is evicted, and A is iterated again after eviction
        await sourceB.initialize();
        expect(pool.size).toBe(1);
        expect(sourceAReadable?.close).not.toHaveBeenCalled();
        const constructorCallsAfterEviction = MockRemoteFileReadable.mock.calls.length;

        const rehydratedIterator = sourceA.messageIterator({
          topics: new Map([[topic, PlayerBuilder.subscribePayload({ topic })]]),
        });
        const rehydratedResult = await rehydratedIterator.next();
        await rehydratedIterator.next();

        // Then A reuses its original RemoteFileReadable instead of opening a new connection, while
        // still rebuilding the indexed reader/parsing state after re-hydration.
        expect(rehydratedResult.value).toMatchObject({ type: "message-event" });
        expect(MockRemoteFileReadable.mock.calls).toHaveLength(constructorCallsAfterEviction);
        expect(sourceAReadable?.open).toHaveBeenCalledTimes(1);
        expect(
          readerInitializeSpy.mock.calls.filter(([arg]) => arg.readable === sourceAReadable),
        ).toHaveLength(2);
      });

      it("recreates a url-backed RemoteFileReadable after a fatal indexed re-hydration failure", async () => {
        // Given two indexed MCAPs served via URL that share a capacity-1 pool
        const topic = "/retry_topic";
        const urlIndexedMcapA = "https://example.com/retry-a.mcap";
        const urlIndexedMcapB = "https://example.com/retry-b.mcap";
        const mcapData = await buildIndexedMcapWithTopic(topic, [1_000_000_000n]);
        const readableInstancesByUrl = mockRemoteFileReadableWith({
          [urlIndexedMcapA]: mcapData,
          [urlIndexedMcapB]: mcapData,
        });
        const pool = new HydratedSourcePool({ maxCount: 1 });
        const sourceA = new McapIterableSource({ type: "url", url: urlIndexedMcapA, pool });
        const sourceB = new McapIterableSource({ type: "url", url: urlIndexedMcapB, pool });
        const realInitialize = McapIndexedReader.Initialize.bind(McapIndexedReader);
        let failRehydrateForReadable: MockRemoteReadable | undefined;
        const fatalError = new Error("fatal indexed init");
        jest.spyOn(McapIndexedReader, "Initialize").mockImplementation(async (args) => {
          if (args.readable === failRehydrateForReadable) {
            failRehydrateForReadable = undefined;
            throw fatalError;
          }
          return await realInitialize(args);
        });

        await sourceA.initialize();
        await sourceB.initialize();

        const firstReadable = readableInstancesByUrl.get(urlIndexedMcapA)?.[0];
        expect(firstReadable).toBeDefined();
        failRehydrateForReadable = firstReadable;

        const failingIterator = sourceA.messageIterator({
          topics: new Map([[topic, PlayerBuilder.subscribePayload({ topic })]]),
        });
        await expect(failingIterator.next()).rejects.toThrow(fatalError);
        expect(firstReadable?.close).toHaveBeenCalledTimes(1);

        const constructorCallsAfterFailure = MockRemoteFileReadable.mock.calls.length;
        const recoveredIterator = sourceA.messageIterator({
          topics: new Map([[topic, PlayerBuilder.subscribePayload({ topic })]]),
        });
        const recoveredResult = await recoveredIterator.next();
        await recoveredIterator.next();

        const secondReadable = readableInstancesByUrl.get(urlIndexedMcapA)?.[1];
        expect(recoveredResult.value).toMatchObject({ type: "message-event" });
        expect(MockRemoteFileReadable.mock.calls).toHaveLength(constructorCallsAfterFailure + 1);
        expect(secondReadable).toBeDefined();
        expect(secondReadable).not.toBe(firstReadable);
        expect(secondReadable?.open).toHaveBeenCalledTimes(1);
      });

      it("returns cached getStart/getEnd for an evicted pooled source without re-hydrating", async () => {
        // Given two indexed MCAPs (message range 2s–8s) sharing a capacity-1 pool
        const mcapData = await buildIndexedMcapWithTopic("/range_topic", [
          2_000_000_000n,
          8_000_000_000n,
        ]);
        mockRemoteFileReadableWith(mcapData);
        const pool = new HydratedSourcePool({ maxCount: 1 });
        const sourceA = new McapIterableSource({ type: "url", url: urlIndexedMcap, pool });
        const sourceB = new McapIterableSource({ type: "url", url: urlIndexedMcap, pool });

        // When initializing both, so A is evicted by B
        await sourceA.initialize();
        await sourceB.initialize();
        const constructorCallsAfterInit = MockRemoteFileReadable.mock.calls.length;

        // Then getStart/getEnd return the cached range without opening a new reader
        expect(sourceA.getStart()).toEqual({ sec: 2, nsec: 0 });
        expect(sourceA.getEnd()).toEqual({ sec: 8, nsec: 0 });
        expect(MockRemoteFileReadable.mock.calls).toHaveLength(constructorCallsAfterInit);
      });

      it("keeps every pooled source resident when N <= pool capacity", async () => {
        // Given two indexed MCAPs sharing a pool with capacity 2
        const mcapData = await buildIndexedMcapWithTopic("/n_topic", [1_000_000_000n]);
        mockRemoteFileReadableWith(mcapData);
        const pool = new HydratedSourcePool({ maxCount: 2 });
        const sourceA = new McapIterableSource({ type: "url", url: urlIndexedMcap, pool });
        const sourceB = new McapIterableSource({ type: "url", url: urlIndexedMcap, pool });

        // When initializing both
        await sourceA.initialize();
        await sourceB.initialize();

        // Then both stay resident and nothing is evicted (no re-open needed later)
        expect(pool.size).toBe(2);
        const firstReadable = MockRemoteFileReadable.mock.results[0]!.value as unknown as {
          close: jest.Mock;
        };
        expect(firstReadable.close).not.toHaveBeenCalled();
      });

      it("terminate() closes the persistent readable once while leaving pool teardown to the owner", async () => {
        // Given a pooled url source whose inner is owned by the pool
        const mcapData = await buildIndexedMcapWithTopic("/term_topic", [1_000_000_000n]);
        const readableInstancesByUrl = mockRemoteFileReadableWith(mcapData);
        const pool = new HydratedSourcePool({ maxCount: 4 });
        const source = new McapIterableSource({ type: "url", url: urlIndexedMcap, pool });
        await source.initialize();
        const readable = readableInstancesByUrl.get(urlIndexedMcap)?.[0];

        // When terminating the source twice
        await expect(source.terminate()).resolves.toBeUndefined();
        await expect(source.terminate()).resolves.toBeUndefined();

        // Then the session-persistent readable is closed exactly once and the pool entry remains
        // owned by the pool.
        expect(readable?.close).toHaveBeenCalledTimes(1);
        expect(pool.size).toBe(1);
      });

      it("terminate() is a no-op when no persistent readable was ever created", async () => {
        // Given a pooled url source that was never initialized
        const source = new McapIterableSource({
          type: "url",
          url: urlIndexedMcap,
          pool: new HydratedSourcePool({ maxCount: 1 }),
        });

        // When / Then
        await expect(source.terminate()).resolves.toBeUndefined();
      });
    });
  });

  describe("When source type is file with a bounded HydratedSourcePool", () => {
    it("admits file sources to the pool and re-hydrates an evicted source on iterate", async () => {
      // Given two indexed MCAP file blobs that share a capacity-1 pool
      const topic = `/${BasicBuilder.string()}`;
      const fileA = await createMcapFile({ withMessage: true, topic });
      const fileB = await createMcapFile({ withMessage: true, topic });
      const pool = new HydratedSourcePool({ maxCount: 1 });
      const sourceA = new McapIterableSource({ type: "file", file: fileA, pool });
      const sourceB = new McapIterableSource({ type: "file", file: fileB, pool });

      // When initializing both sources
      await sourceA.initialize();
      await sourceB.initialize();

      // Then only one inner stays resident: B was admitted last, so A was evicted
      expect(pool.size).toBe(1);

      // When iterating the evicted source A
      const iterator = sourceA.messageIterator({
        topics: new Map([[topic, PlayerBuilder.subscribePayload({ topic })]]),
      });
      const result = await iterator.next();

      // Then it re-hydrates (re-opens the blob reader) and still yields the message event
      expect(result.value).toMatchObject({ type: "message-event" });

      // Drain to trigger release() in the iterator's finally block
      await iterator.next();
    });

    it("keeps every file source resident when N <= pool capacity", async () => {
      // Given two indexed MCAP file blobs sharing a pool with capacity 2
      const topic = `/${BasicBuilder.string()}`;
      const fileA = await createMcapFile({ withMessage: true, topic });
      const fileB = await createMcapFile({ withMessage: true, topic });
      const pool = new HydratedSourcePool({ maxCount: 2 });
      const sourceA = new McapIterableSource({ type: "file", file: fileA, pool });
      const sourceB = new McapIterableSource({ type: "file", file: fileB, pool });

      // When initializing both
      await sourceA.initialize();
      await sourceB.initialize();

      // Then both stay resident and nothing is evicted
      expect(pool.size).toBe(2);
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

    it("surfaces a real initialization error instead of silently falling back to unindexed (operational failure, not a genuinely unindexed file)", async () => {
      // Given
      const file = await createMcapFile({ withMessage: true });
      const source = new McapIterableSource({ type: "file", file });

      const initializeSpy = jest
        .spyOn(McapIndexedReader, "Initialize")
        .mockRejectedValue(new Error("Corrupt MCAP file"));
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      // When / Then
      await expect(source.initialize()).rejects.toThrow("Corrupt MCAP file");
      expect(initializeSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(new Error("Corrupt MCAP file"));
    });

    it("still falls back to unindexed reader when Initialize throws the genuine 'File is not indexed' error", async () => {
      // Given
      const file = await createMcapFile({ withMessage: true });
      const source = new McapIterableSource({ type: "file", file });

      jest
        .spyOn(McapIndexedReader, "Initialize")
        .mockRejectedValue(new Error("File is not indexed [library=test]"));

      // When
      const result = await source.initialize();

      // Then — genuinely unindexed (per the real @mcap/core error signal) still falls back safely
      expect(result).toBeDefined();
      expect(result.topics).toHaveLength(1);
      expect(result.topics[0]?.name).toBe("/test");
    });
  });

  describe("messageIterator", () => {
    it("should throw when source has not been initialized", async () => {
      // Given a source that has not been initialized
      const source = new McapIterableSource({
        type: "file",
        file: new Blob([]) as unknown as globalThis.Blob,
      });

      // When iterating messageIterator before initialize
      // Then it should throw (the async generator body runs on first next())
      await expect(source.messageIterator({ topics: new Map() }).next()).rejects.toThrow(
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
