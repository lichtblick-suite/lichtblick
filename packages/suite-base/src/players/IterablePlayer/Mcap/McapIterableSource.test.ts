// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapIndexedReader, McapWriter } from "@mcap/core";
import { Blob } from "node:buffer";

import { loadDecompressHandlers, TempBuffer } from "@lichtblick/mcap-support";
import { BasicBuilder } from "@lichtblick/test-builders";

import { McapIterableSource } from "./McapIterableSource";

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
    const testBuffer = new TempBuffer();
    const readerInitializeSpy = jest.spyOn(McapIndexedReader, "Initialize");
    const writer = new McapWriter({ writable: testBuffer });
    const topic = `/${BasicBuilder.string()}`;
    await writer.start({ library: "test", profile: "" });

    const schemaId = await writer.registerSchema({
      name: BasicBuilder.string(),
      encoding: "jsonschema",
      data: new TextEncoder().encode(JSON.stringify({ type: "object" })),
    });
    const channelId = await writer.registerChannel({
      schemaId,
      topic,
      messageEncoding: "json",
      metadata: new Map(),
    });

    // Add a message to ensure file is not empty
    await addMessage(writer, channelId);
    await writer.end();

    const source = new McapIterableSource({
      type: "file",
      file: new Blob([testBuffer.get()]) as unknown as globalThis.Blob,
    });

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
});
