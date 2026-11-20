// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { McapIndexedReader, McapStreamReader } from "@mcap/core";
import type { IReadable, TypedMcapRecord } from "@mcap/core";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { MCAP_FIXTURE_MANIFEST } from "./constants";
import { generateMcapFixtures, getMcapFixtureFileName } from "./generateMcapFixtures";

const SMALL_OPTIONS = { fileCount: 2, durationSec: 1, rateHz: 50, payloadBytes: 64 };

/** File contents as a plain `Uint8Array` (Node's `Buffer` typings don't match TS 6 DOM libs). */
function readBytes(filePath: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(filePath));
}

function fileReadable(filePath: string): IReadable {
  const bytes = readBytes(filePath);
  return {
    size: async () => BigInt(bytes.byteLength),
    read: async (offset: bigint, length: bigint) =>
      bytes.subarray(Number(offset), Number(offset + length)),
  };
}

describe("generateMcapFixtures", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "benchmark-mcap-fixtures-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("should write indexed MCAP files with the expected topic, encodings and counts", async () => {
    // Given / When
    const names = await generateMcapFixtures(dir, SMALL_OPTIONS);

    // Then
    expect(names).toEqual([getMcapFixtureFileName(0), getMcapFixtureFileName(1)]);
    for (const name of names) {
      const reader = await McapIndexedReader.Initialize({
        readable: fileReadable(path.join(dir, name)),
      });
      expect(reader.chunkIndexes.length).toBeGreaterThan(0);
      expect(reader.statistics?.messageCount).toBe(50n);
      const [channel] = [...reader.channelsById.values()];
      expect(channel?.topic).toBe("/benchmark/multi");
      expect(channel?.messageEncoding).toBe("json");
      expect(reader.schemasById.get(channel!.schemaId)?.encoding).toBe("jsonschema");

      let count = 0;
      for await (const message of reader.readMessages()) {
        const decoded = JSON.parse(new TextDecoder().decode(message.data)) as {
          value: number;
          seq: number;
          payload: string;
        };
        expect(decoded.seq).toBe(count);
        expect(decoded.payload).toHaveLength(64);
        count++;
      }
      expect(count).toBe(50);
    }
  });

  it("should give every file the same time range", async () => {
    // Given
    const names = await generateMcapFixtures(dir, SMALL_OPTIONS);

    // When
    const ranges: [bigint | undefined, bigint | undefined][] = [];
    for (const name of names) {
      const reader = await McapIndexedReader.Initialize({
        readable: fileReadable(path.join(dir, name)),
      });
      ranges.push([reader.statistics?.messageStartTime, reader.statistics?.messageEndTime]);
    }

    // Then
    expect(ranges[0]).toEqual(ranges[1]);
    expect(ranges[0]![1]! - ranges[0]![0]!).toBe(980_000_000n); // 49 periods of 20 ms
  });

  it("should be readable by the stream reader with one message record per sample", async () => {
    // Given
    const [name] = await generateMcapFixtures(dir, SMALL_OPTIONS);
    const reader = new McapStreamReader();
    reader.append(readBytes(path.join(dir, name!)));

    // When
    let messages = 0;
    let record: TypedMcapRecord | undefined;
    while ((record = reader.nextRecord()) != undefined) {
      if (record.type === "Message") {
        messages++;
      }
    }

    // Then
    expect(messages).toBe(50);
    expect(reader.done()).toBe(true);
  });

  it("should be deterministic and skip regeneration when the manifest matches", async () => {
    // Given
    const [name] = await generateMcapFixtures(dir, SMALL_OPTIONS);
    const filePath = path.join(dir, name!);
    const firstBytes = readBytes(filePath);
    const firstMtime = fs.statSync(filePath).mtimeMs;

    // When
    await new Promise((resolve) => setTimeout(resolve, 20));
    await generateMcapFixtures(dir, SMALL_OPTIONS);

    // Then
    expect(fs.statSync(filePath).mtimeMs).toBe(firstMtime);
    const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), "benchmark-mcap-fixtures-"));
    try {
      await generateMcapFixtures(otherDir, SMALL_OPTIONS);
      expect(readBytes(path.join(otherDir, name!))).toEqual(firstBytes);
    } finally {
      fs.rmSync(otherDir, { recursive: true, force: true });
    }
  });

  it("should regenerate when the options change or a file is missing", async () => {
    // Given
    await generateMcapFixtures(dir, SMALL_OPTIONS);
    fs.rmSync(path.join(dir, getMcapFixtureFileName(1)));

    // When
    const names = await generateMcapFixtures(dir, SMALL_OPTIONS);
    const moreFiles = await generateMcapFixtures(dir, { ...SMALL_OPTIONS, fileCount: 3 });

    // Then
    expect(fs.existsSync(path.join(dir, names[1]!))).toBe(true);
    expect(moreFiles).toHaveLength(3);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, MCAP_FIXTURE_MANIFEST), "utf-8"));
    expect(manifest.files).toHaveLength(3);
  });
});
