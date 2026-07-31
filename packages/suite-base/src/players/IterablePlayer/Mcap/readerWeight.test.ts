// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { McapIndexedReader } from "@mcap/core";

import { READER_BASE_BYTES, estimateReaderWeightBytes } from "./readerWeight";

function makeReader(chunkIndexCount: number, channelCount: number): McapIndexedReader {
  return {
    chunkIndexes: Array.from({ length: chunkIndexCount }, () => ({})),
    channelsById: new Map(Array.from({ length: channelCount }, (_, i) => [i, {}])),
  } as unknown as McapIndexedReader;
}

describe("estimateReaderWeightBytes", () => {
  it("returns the base weight for a reader with no chunks or channels", () => {
    // GIVEN: a reader with no chunk indexes or channels and no cache bytes.
    const reader = makeReader(0, 0);

    // WHEN: estimating its weight.
    const weight = estimateReaderWeightBytes(reader, 0);

    // THEN: only the fixed base overhead is counted.
    expect(weight).toBe(READER_BASE_BYTES);
  });

  it("scales with chunk index count", () => {
    // GIVEN: a reader with 10 chunk indexes.
    const reader = makeReader(10, 0);

    // WHEN: estimating its weight.
    const weight = estimateReaderWeightBytes(reader, 0);

    // THEN: the weight includes the per-chunk-index contribution.
    expect(weight).toBe(READER_BASE_BYTES + 10 * 512);
  });

  it("scales with channel count", () => {
    // GIVEN: a reader with 5 channels.
    const reader = makeReader(0, 5);

    // WHEN: estimating its weight.
    const weight = estimateReaderWeightBytes(reader, 0);

    // THEN: the weight includes the per-channel contribution.
    expect(weight).toBe(READER_BASE_BYTES + 5 * 16 * 1024);
  });

  it("adds the provided cache bytes on top of the base weight", () => {
    // GIVEN: a reader with no chunks/channels and a non-zero cache budget.
    const reader = makeReader(0, 0);

    // WHEN: estimating its weight with 1024 cache bytes.
    const weight = estimateReaderWeightBytes(reader, 1024);

    // THEN: the cache bytes are added on top of the base weight.
    expect(weight).toBe(READER_BASE_BYTES + 1024);
  });
});
