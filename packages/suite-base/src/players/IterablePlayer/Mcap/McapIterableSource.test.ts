// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapWriter } from "@mcap/core";
import { Blob } from "node:buffer";

import { TempBuffer } from "@lichtblick/mcap-support";
import { BasicBuilder } from "@lichtblick/test-builders";

import { McapIterableSource } from "./McapIterableSource";
import { RemoteFileReadable } from "./RemoteFileReadable";

jest.mock("./RemoteFileReadable");

const MockRemoteFileReadable = RemoteFileReadable as jest.MockedClass<typeof RemoteFileReadable>;

describe("McapIterableSource", () => {
  beforeEach(() => {
    MockRemoteFileReadable.mockClear();
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

  describe("url source type", () => {
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
  });
});
