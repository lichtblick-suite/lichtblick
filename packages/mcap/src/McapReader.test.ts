// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { crc32 } from "@foxglove/crc";

import McapReader from "./McapReader";
import { MCAP_MAGIC, RecordType } from "./constants";

function uint32LE(n: number): Uint8Array {
  const result = new Uint8Array(4);
  new DataView(result.buffer).setUint32(0, n, true);
  return result;
}
function uint64LE(n: bigint): Uint8Array {
  const result = new Uint8Array(8);
  new DataView(result.buffer).setBigUint64(0, n, true);
  return result;
}
function string(str: string): Uint8Array {
  const encoded = new TextEncoder().encode(str);
  const result = new Uint8Array(4 + encoded.length);
  new DataView(result.buffer).setUint32(0, encoded.length, true);
  result.set(encoded, 4);
  return result;
}
function record(type: RecordType, data: number[]): Uint8Array {
  if (type === RecordType.FOOTER) {
    const result = new Uint8Array(1 + data.length);
    result[0] = type;
    result.set(data, 1);
    return result;
  }
  const result = new Uint8Array(5 + data.length);
  result[0] = type;
  new DataView(result.buffer).setUint32(1, data.length, true);
  result.set(data, 5);
  return result;
}

const formatVersion = 1;

describe("McapReader", () => {
  it("rejects invalid header", () => {
    for (let i = 0; i < MCAP_MAGIC.length - 1; i++) {
      const reader = new McapReader();
      const badMagic = MCAP_MAGIC.slice();
      badMagic[i] = 0x00;
      reader.append(new Uint8Array([...badMagic, formatVersion]));
      expect(() => reader.nextRecord()).toThrow("Expected MCAP magic");
    }
  });

  it("rejects invalid footer magic", () => {
    const reader = new McapReader();
    reader.append(
      new Uint8Array([
        ...MCAP_MAGIC,
        formatVersion,
        ...record(RecordType.FOOTER, [
          ...uint64LE(0x0123456789abcdefn), // index pos
          ...uint32LE(0x01234567), // index crc
        ]),
        ...MCAP_MAGIC.slice(0, MCAP_MAGIC.length - 1),
        0x00,
        formatVersion,
      ]),
    );
    expect(() => reader.nextRecord()).toThrow("Expected MCAP magic");
  });

  it("parses empty file", () => {
    const reader = new McapReader();
    reader.append(
      new Uint8Array([
        ...MCAP_MAGIC,
        formatVersion,
        ...record(RecordType.FOOTER, [
          ...uint64LE(0x0123456789abcdefn), // index pos
          ...uint32LE(0x01234567), // index crc
        ]),
        ...MCAP_MAGIC,
        formatVersion,
      ]),
    );
    expect(reader.nextRecord()).toEqual({
      type: "Footer",
      indexPos: 0x0123456789abcdefn,
      indexCrc: 0x01234567,
    });
    expect(reader.done()).toBe(true);
  });

  it("accepts empty chunks", () => {
    const reader = new McapReader();
    reader.append(
      new Uint8Array([
        ...MCAP_MAGIC,
        formatVersion,
        ...record(RecordType.CHUNK, [
          ...uint64LE(0n), // decompressed size
          ...uint32LE(0), // decompressed crc32
          ...string("lz4"), // compression
          // no chunk data
        ]),
        ...record(RecordType.FOOTER, [
          ...uint64LE(0n), // index pos
          ...uint32LE(0), // index crc
        ]),
        ...MCAP_MAGIC,
        formatVersion,
      ]),
    );
    expect(reader.nextRecord()).toEqual({
      type: "Footer",
      indexPos: 0n,
      indexCrc: 0,
    });
    expect(reader.done()).toBe(true);
  });

  it("waits patiently to parse one byte at a time, and rejects new data after read completed", () => {
    const reader = new McapReader();
    const data = new Uint8Array([
      ...MCAP_MAGIC,
      formatVersion,
      ...record(RecordType.FOOTER, [
        ...uint64LE(0x0123456789abcdefn), // index pos
        ...uint32LE(0x01234567), // index crc
      ]),
      ...MCAP_MAGIC,
      formatVersion,
    ]);
    for (let i = 0; i < data.length - 1; i++) {
      reader.append(new Uint8Array(data.buffer, i, 1));
      expect(reader.nextRecord()).toBeUndefined();
      expect(reader.done()).toBe(false);
    }
    reader.append(new Uint8Array(data.buffer, data.length - 1, 1));
    expect(reader.nextRecord()).toEqual({
      type: "Footer",
      indexPos: 0x0123456789abcdefn,
      indexCrc: 0x01234567,
    });
    expect(reader.done()).toBe(true);
    expect(() => reader.append(new Uint8Array([42]))).toThrow("Already done reading");
  });

  it("rejects unknown format version in header", () => {
    const reader = new McapReader();
    reader.append(new Uint8Array([...MCAP_MAGIC, 2]));
    expect(() => reader.nextRecord()).toThrow("Unsupported format version 2");
  });

  it("rejects unknown format version in footer", () => {
    const reader = new McapReader();
    reader.append(
      new Uint8Array([
        ...MCAP_MAGIC,
        formatVersion,
        ...record(RecordType.FOOTER, [
          ...uint64LE(0x0123456789abcdefn), // index pos
          ...uint32LE(0x01234567), // index crc
        ]),
        ...MCAP_MAGIC,
        2,
      ]),
    );
    expect(() => reader.nextRecord()).toThrow("Unsupported format version 2");
  });

  it("rejects extraneous data at end of file", () => {
    const reader = new McapReader();
    reader.append(
      new Uint8Array([
        ...MCAP_MAGIC,
        formatVersion,
        ...record(RecordType.FOOTER, [
          ...uint64LE(0x0123456789abcdefn), // index pos
          ...uint32LE(0x01234567), // index crc
        ]),
        ...MCAP_MAGIC,
        formatVersion,
        42,
      ]),
    );
    expect(() => reader.nextRecord()).toThrow("bytes remaining after MCAP footer");
  });

  it("parses file with empty chunk", () => {
    const reader = new McapReader();
    reader.append(
      new Uint8Array([
        ...MCAP_MAGIC,
        formatVersion,

        ...record(RecordType.CHUNK, [
          ...uint64LE(0n), // decompressed size
          ...uint32LE(0), // decompressed crc32
          ...string(""), // compression
          // (no chunk data)
        ]),

        ...record(RecordType.FOOTER, [
          ...uint64LE(0n), // index pos
          ...uint32LE(0), // index crc
        ]),
        ...MCAP_MAGIC,
        formatVersion,
      ]),
    );
    expect(reader.nextRecord()).toEqual({ type: "Footer", indexPos: 0n, indexCrc: 0 });
    expect(reader.done()).toBe(true);
  });

  it("rejects chunk with incomplete record", () => {
    const reader = new McapReader();
    reader.append(
      new Uint8Array([
        ...MCAP_MAGIC,
        formatVersion,

        ...record(RecordType.CHUNK, [
          ...uint64LE(1n), // decompressed size
          ...uint32LE(crc32(new Uint8Array([RecordType.CHANNEL_INFO]))), // decompressed crc32
          ...string(""), // compression

          RecordType.CHANNEL_INFO, // truncated record
        ]),

        ...record(RecordType.FOOTER, [
          ...uint64LE(0n), // index pos
          ...uint32LE(0), // index crc
        ]),
        ...MCAP_MAGIC,
        formatVersion,
      ]),
    );
    expect(() => reader.nextRecord()).toThrow("bytes remaining in chunk");
  });

  it("rejects message at top level with no prior channel info", () => {
    const reader = new McapReader();
    reader.append(
      new Uint8Array([
        ...MCAP_MAGIC,
        formatVersion,

        ...record(RecordType.MESSAGE, [
          ...uint32LE(42), // channel id
          ...uint64LE(0n), // timestamp
        ]),

        ...record(RecordType.FOOTER, [
          ...uint64LE(0n), // index pos
          ...uint32LE(0), // index crc
        ]),
        ...MCAP_MAGIC,
        formatVersion,
      ]),
    );
    expect(() => reader.nextRecord()).toThrow(
      "Encountered message on channel 42 without prior channel info",
    );
  });

  it("rejects message in chunk with no prior channel info", () => {
    const message = record(RecordType.MESSAGE, [
      ...uint32LE(42), // channel id
      ...uint64LE(0n), // timestamp
    ]);
    const reader = new McapReader();
    reader.append(
      new Uint8Array([
        ...MCAP_MAGIC,
        formatVersion,

        ...record(RecordType.CHUNK, [
          ...uint64LE(0n), // decompressed size
          ...uint32LE(crc32(message)), // decompressed crc32
          ...string(""), // compression
          ...message,
        ]),

        ...record(RecordType.FOOTER, [
          ...uint64LE(0n), // index pos
          ...uint32LE(0), // index crc
        ]),
        ...MCAP_MAGIC,
        formatVersion,
      ]),
    );
    expect(() => reader.nextRecord()).toThrow(
      "Encountered message on channel 42 without prior channel info",
    );
  });

  it("rejects message in chunk with no prior channel info in the same chunk", () => {
    const channelInfo = record(RecordType.CHANNEL_INFO, [
      ...uint32LE(42), // channel id
      ...string("mytopic"), // topic
      ...string("utf12"), // encoding
      ...string("some data"), // schema name
      ...string("stuff"), // schema
      ...[1, 2, 3], // channel data
    ]);
    const message = record(RecordType.MESSAGE, [
      ...uint32LE(42), // channel id
      ...uint64LE(1n), // timestamp
    ]);
    const reader = new McapReader();
    reader.append(
      new Uint8Array([
        ...MCAP_MAGIC,
        formatVersion,

        ...record(RecordType.CHUNK, [
          ...uint64LE(0n), // decompressed size
          ...uint32LE(crc32(new Uint8Array([...channelInfo, ...message]))), // decompressed crc32
          ...string(""), // compression
          ...channelInfo,
          ...message,
        ]),

        ...record(RecordType.CHUNK, [
          ...uint64LE(0n), // decompressed size
          ...uint32LE(crc32(message)), // decompressed crc32
          ...string(""), // compression
          ...message,
        ]),

        ...record(RecordType.FOOTER, [
          ...uint64LE(0n), // index pos
          ...uint32LE(0), // index crc
        ]),
        ...MCAP_MAGIC,
        formatVersion,
      ]),
    );
    const expectedChannelInfo = {
      type: "ChannelInfo",
      id: 42,
      topic: "mytopic",
      encoding: "utf12",
      schemaName: "some data",
      schema: "stuff",
      data: new Uint8Array([1, 2, 3]).buffer,
    };
    expect(reader.nextRecord()).toEqual(expectedChannelInfo);
    expect(reader.nextRecord()).toEqual({
      type: "Message",
      channelInfo: expectedChannelInfo,
      timestamp: 1n,
      data: new ArrayBuffer(0),
    });
    expect(() => reader.nextRecord()).toThrow(
      "Encountered message on channel 42 without prior channel info in this chunk",
    );
  });

  it("parses message and returns reference-equal channel info on the same channel in different chunks", () => {
    const channelInfo = record(RecordType.CHANNEL_INFO, [
      ...uint32LE(42), // channel id
      ...string("mytopic"), // topic
      ...string("utf12"), // encoding
      ...string("some data"), // schema name
      ...string("stuff"), // schema
      ...[1, 2, 3], // channel data
    ]);
    const message = record(RecordType.MESSAGE, [
      ...uint32LE(42), // channel id
      ...uint64LE(1n), // timestamp
    ]);
    const reader = new McapReader();
    reader.append(
      new Uint8Array([
        ...MCAP_MAGIC,
        formatVersion,

        ...record(RecordType.CHUNK, [
          ...uint64LE(0n), // decompressed size
          ...uint32LE(crc32(new Uint8Array([...channelInfo, ...message]))), // decompressed crc32
          ...string(""), // compression
          ...channelInfo,
          ...message,
        ]),

        ...record(RecordType.CHUNK, [
          ...uint64LE(0n), // decompressed size
          ...uint32LE(crc32(new Uint8Array([...channelInfo, ...message]))), // decompressed crc32
          ...string(""), // compression
          ...channelInfo,
          ...message,
        ]),

        ...record(RecordType.FOOTER, [
          ...uint64LE(0n), // index pos
          ...uint32LE(0), // index crc
        ]),
        ...MCAP_MAGIC,
        formatVersion,
      ]),
    );
    const expectedChannelInfo = {
      type: "ChannelInfo",
      id: 42,
      topic: "mytopic",
      encoding: "utf12",
      schemaName: "some data",
      schema: "stuff",
      data: new Uint8Array([1, 2, 3]).buffer,
    };
    const actualChannelInfo = reader.nextRecord();
    expect(actualChannelInfo).toEqual(expectedChannelInfo);
    expect(reader.nextRecord()).toEqual({
      type: "Message",
      channelInfo: expectedChannelInfo,
      timestamp: 1n,
      data: new ArrayBuffer(0),
    });
    expect(reader.nextRecord()).toBe(actualChannelInfo);
    expect(reader.nextRecord()).toEqual({
      type: "Message",
      channelInfo: expectedChannelInfo,
      timestamp: 1n,
      data: new ArrayBuffer(0),
    });
  });

  it("parses channel info at top level", () => {
    const reader = new McapReader();
    reader.append(
      new Uint8Array([
        ...MCAP_MAGIC,
        formatVersion,

        ...record(RecordType.CHANNEL_INFO, [
          ...uint32LE(1), // channel id
          ...string("mytopic"), // topic
          ...string("utf12"), // encoding
          ...string("some data"), // schema name
          ...string("stuff"), // schema
          ...[1, 2, 3], // channel data
        ]),

        ...record(RecordType.FOOTER, [
          ...uint64LE(0n), // index pos
          ...uint32LE(0), // index crc
        ]),
        ...MCAP_MAGIC,
        formatVersion,
      ]),
    );
    expect(reader.nextRecord()).toEqual({
      type: "ChannelInfo",
      id: 1,
      topic: "mytopic",
      encoding: "utf12",
      schemaName: "some data",
      schema: "stuff",
      data: new Uint8Array([1, 2, 3]).buffer,
    });
    expect(reader.nextRecord()).toEqual({ type: "Footer", indexPos: 0n, indexCrc: 0 });
    expect(reader.done()).toBe(true);
  });

  it.each([true, false])("parses channel info in chunk (compressed: %s)", (compressed) => {
    const channelInfo = record(RecordType.CHANNEL_INFO, [
      ...uint32LE(1), // channel id
      ...string("mytopic"), // topic
      ...string("utf12"), // encoding
      ...string("some data"), // schema name
      ...string("stuff"), // schema
      ...[1, 2, 3], // channel data
    ]);
    const decompressHandlers = { xyz: () => channelInfo };
    const reader = new McapReader(compressed ? { decompressHandlers } : undefined);
    reader.append(
      new Uint8Array([
        ...MCAP_MAGIC,
        formatVersion,

        ...record(RecordType.CHUNK, [
          ...uint64LE(0n), // decompressed size
          ...uint32LE(crc32(channelInfo)), // decompressed crc32
          ...string(compressed ? "xyz" : ""), // compression
          ...(compressed ? new TextEncoder().encode("compressed bytes") : channelInfo),
        ]),

        ...record(RecordType.FOOTER, [
          ...uint64LE(0n), // index pos
          ...uint32LE(0), // index crc
        ]),
        ...MCAP_MAGIC,
        formatVersion,
      ]),
    );
    expect(reader.nextRecord()).toEqual({
      type: "ChannelInfo",
      id: 1,
      topic: "mytopic",
      encoding: "utf12",
      schemaName: "some data",
      schema: "stuff",
      data: new Uint8Array([1, 2, 3]).buffer,
    });
    expect(reader.nextRecord()).toEqual({ type: "Footer", indexPos: 0n, indexCrc: 0 });
    expect(reader.done()).toBe(true);
  });

  describe.each(["unchunked file", "same chunk", "different chunks"] as const)(
    "rejects channel info with the same id in %s",
    (testType) => {
      it.each([
        {
          key: "topic",
          channelInfo2: record(RecordType.CHANNEL_INFO, [
            ...uint32LE(42), // channel id
            ...string("XXXXXXXX"), // topic
            ...string("utf12"), // encoding
            ...string("some data"), // schema name
            ...string("stuff"), // schema
            ...[1, 2, 3], // channel data
          ]),
        },
        {
          key: "encoding",
          channelInfo2: record(RecordType.CHANNEL_INFO, [
            ...uint32LE(42), // channel id
            ...string("mytopic"), // topic
            ...string("XXXXXXXX"), // encoding
            ...string("some data"), // schema name
            ...string("stuff"), // schema
            ...[1, 2, 3], // channel data
          ]),
        },
        {
          key: "schema name",
          channelInfo2: record(RecordType.CHANNEL_INFO, [
            ...uint32LE(42), // channel id
            ...string("mytopic"), // topic
            ...string("utf12"), // encoding
            ...string("XXXXXXXX"), // schema name
            ...string("stuff"), // schema
            ...[1, 2, 3], // channel data
          ]),
        },
        {
          key: "schema",
          channelInfo2: record(RecordType.CHANNEL_INFO, [
            ...uint32LE(42), // channel id
            ...string("mytopic"), // topic
            ...string("utf12"), // encoding
            ...string("some data"), // schema name
            ...string("XXXXXXXX"), // schema
            ...[1, 2, 3], // channel data
          ]),
        },
        {
          key: "data",
          channelInfo2: record(RecordType.CHANNEL_INFO, [
            ...uint32LE(42), // channel id
            ...string("mytopic"), // topic
            ...string("utf12"), // encoding
            ...string("some data"), // schema name
            ...string("stuff"), // schema
            ...[0xff], // channel data
          ]),
        },
      ])("differing in $key", ({ channelInfo2 }) => {
        const channelInfo = record(RecordType.CHANNEL_INFO, [
          ...uint32LE(42), // channel id
          ...string("mytopic"), // topic
          ...string("utf12"), // encoding
          ...string("some data"), // schema name
          ...string("stuff"), // schema
          ...[1, 2, 3], // channel data
        ]);
        const reader = new McapReader();
        reader.append(
          new Uint8Array([
            ...MCAP_MAGIC,
            formatVersion,

            ...(testType === "unchunked file"
              ? [...channelInfo, ...channelInfo2]
              : testType === "same chunk"
              ? record(RecordType.CHUNK, [
                  ...uint64LE(0n), // decompressed size
                  ...uint32LE(crc32(new Uint8Array([...channelInfo, ...channelInfo2]))), // decompressed crc32
                  ...string(""), // compression
                  ...channelInfo,
                  ...channelInfo2,
                ])
              : testType === "different chunks"
              ? [
                  ...record(RecordType.CHUNK, [
                    ...uint64LE(0n), // decompressed size
                    ...uint32LE(crc32(new Uint8Array(channelInfo))), // decompressed crc32
                    ...string(""), // compression
                    ...channelInfo,
                  ]),
                  ...record(RecordType.CHUNK, [
                    ...uint64LE(0n), // decompressed size
                    ...uint32LE(crc32(new Uint8Array(channelInfo2))), // decompressed crc32
                    ...string(""), // compression
                    ...channelInfo2,
                  ]),
                ]
              : []),

            ...record(RecordType.FOOTER, [
              ...uint64LE(0n), // index pos
              ...uint32LE(0), // index crc
            ]),
            ...MCAP_MAGIC,
            formatVersion,
          ]),
        );
        expect(reader.nextRecord()).toEqual({
          type: "ChannelInfo",
          id: 42,
          topic: "mytopic",
          encoding: "utf12",
          schemaName: "some data",
          schema: "stuff",
          data: new Uint8Array([1, 2, 3]).buffer,
        });
        expect(() => reader.nextRecord()).toThrow("differing channel infos for 42");
      });
    },
  );
});
