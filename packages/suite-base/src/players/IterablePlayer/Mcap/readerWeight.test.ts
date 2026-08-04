// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { McapIndexedReader } from "@mcap/core";

import { READER_BASE_BYTES, estimateReaderWeightBytes } from "./readerWeight";

function makeReader(
  chunkIndexCount: number,
  channelCount: number,
  messageIndexEntriesPerChunk = 0,
): McapIndexedReader {
  return {
    chunkIndexes: Array.from({ length: chunkIndexCount }, () => ({
      messageIndexOffsets: new Map(
        Array.from({ length: messageIndexEntriesPerChunk }, (_, i) => [i, 0n]),
      ),
    })),
    channelsById: new Map(Array.from({ length: channelCount }, (_, i) => [i, {}])),
  } as unknown as McapIndexedReader;
}

describe("estimateReaderWeightBytes", () => {
  it("returns the base weight for a reader with no chunks or channels", () => {
    // GIVEN: a reader with no chunk indexes or channels.
    const reader = makeReader(0, 0);

    // WHEN: estimating its weight.
    const weight = estimateReaderWeightBytes(reader);

    // THEN: only the fixed base overhead is counted.
    expect(weight).toBe(READER_BASE_BYTES);
  });

  it("scales with chunk index count", () => {
    // GIVEN: a reader with 10 chunk indexes and no per-chunk message-index entries.
    const reader = makeReader(10, 0);

    // WHEN: estimating its weight.
    const weight = estimateReaderWeightBytes(reader);

    // THEN: the weight includes the per-chunk-index base contribution.
    expect(weight).toBe(READER_BASE_BYTES + 10 * 128);
  });

  it("scales with per-chunk messageIndexOffsets entries (dominant real cost for many-channel files)", () => {
    // GIVEN: a reader with 10 chunk indexes, each covering 20 channels (200 total map entries).
    const reader = makeReader(10, 0, 20);

    // WHEN: estimating its weight.
    const weight = estimateReaderWeightBytes(reader);

    // THEN: the weight includes the per-chunk-index base PLUS the per-message-index-entry cost,
    // which scales with chunkCount × channelsPerChunk, not chunk count alone.
    expect(weight).toBe(READER_BASE_BYTES + 10 * 128 + 10 * 20 * 64);
  });

  it("scales with channel count", () => {
    // GIVEN: a reader with 5 channels.
    const reader = makeReader(0, 5);

    // WHEN: estimating its weight.
    const weight = estimateReaderWeightBytes(reader);

    // THEN: the weight includes the per-channel contribution.
    expect(weight).toBe(READER_BASE_BYTES + 5 * 16 * 1024);
  });

  it("combines chunk, message-index, and channel contributions without any external cache budget", () => {
    // GIVEN: a reader with 2 chunk indexes, 3 message-index entries per chunk, and 4 channels.
    const reader = makeReader(2, 4, 3);

    // WHEN: estimating its weight.
    const weight = estimateReaderWeightBytes(reader);

    // THEN: only the evictable indexed-reader structures contribute to the pool weight.
    expect(weight).toBe(READER_BASE_BYTES + 2 * 128 + 2 * 3 * 64 + 4 * 16 * 1024);
  });
});
