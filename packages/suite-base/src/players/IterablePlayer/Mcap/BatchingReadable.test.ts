// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { McapTypes } from "@mcap/core";

import { BatchingReadable } from "./BatchingReadable";

const DEFAULT_THRESHOLD = 64 * 1024;

/**
 * Deterministic bytes for a given absolute offset/size window, where each byte
 * equals `(offset + i) % 256`. This lets tests assert that each caller received
 * exactly the bytes for its own offset/size slice after coalescing.
 */
function expectedBytes(offset: bigint, size: bigint): Uint8Array {
  const out = new Uint8Array(Number(size));
  for (let i = 0; i < out.length; i++) {
    out[i] = Number((offset + BigInt(i)) % 256n);
  }
  return out;
}

type MockInner = McapTypes.IReadable & {
  read: jest.Mock<Promise<Uint8Array>, [bigint, bigint]>;
  size: jest.Mock<Promise<bigint>, []>;
};

/**
 * Creates a mock `McapTypes.IReadable` whose `read(offset, size)` returns the
 * deterministic byte window described by `expectedBytes`.
 */
function makeMockInner(sizeValue: bigint = 1024n): MockInner {
  const read = jest.fn(async (offset: bigint, size: bigint): Promise<Uint8Array> => {
    return expectedBytes(offset, size);
  });
  const size = jest.fn(async (): Promise<bigint> => sizeValue);
  return { read, size };
}

describe("BatchingReadable", () => {
  it("should delegate size() to inner and return its bigint value", async () => {
    // Given
    const inner = makeMockInner(4096n);
    const readable = new BatchingReadable(inner);

    // When
    const result = await readable.size();

    // Then
    expect(result).toBe(4096n);
    expect(inner.size).toHaveBeenCalledTimes(1);
  });

  it("should pass a single read through as exactly one inner.read with the same offset/size", async () => {
    // Given
    const inner = makeMockInner();
    const readable = new BatchingReadable(inner);

    // When
    const data = await readable.read(10n, 20n);

    // Then
    expect(inner.read).toHaveBeenCalledTimes(1);
    expect(inner.read).toHaveBeenCalledWith(10n, 20n);
    expect(data).toEqual(expectedBytes(10n, 20n));
  });

  it("should forward the inner buffer unchanged (zero-copy) for a single-member read", async () => {
    // Given a single read, which is the common/only case during sequential
    // MCAP iteration
    const returned = new Uint8Array([1, 2, 3, 4]);
    const inner = makeMockInner();
    inner.read.mockResolvedValueOnce(returned);
    const readable = new BatchingReadable(inner);

    // When
    const data = await readable.read(0n, 4n);

    // Then the exact same buffer instance is forwarded (no copy)
    expect(inner.read).toHaveBeenCalledTimes(1);
    expect(data).toBe(returned);
  });

  it("should coalesce adjacent reads in the same tick into one inner.read and slice correctly", async () => {
    // Given
    const inner = makeMockInner();
    const readable = new BatchingReadable(inner);

    // When
    const promiseA = readable.read(0n, 100n);
    const promiseB = readable.read(200n, 100n);
    const [dataA, dataB] = await Promise.all([promiseA, promiseB]);

    // Then
    expect(inner.read).toHaveBeenCalledTimes(1);
    expect(inner.read).toHaveBeenCalledWith(0n, 300n);
    expect(dataA).toEqual(expectedBytes(0n, 100n));
    expect(dataB).toEqual(expectedBytes(200n, 100n));
  });

  it("should merge two reads whose gap is at the threshold boundary into one inner.read", async () => {
    // Given
    const inner = makeMockInner(2n ** 40n);
    const readable = new BatchingReadable(inner);
    // Read A ends at offset 100. Merge condition is `offset <= end + threshold`,
    // so an offset of exactly `100 + threshold` still merges.
    const bOffset = BigInt(100 + DEFAULT_THRESHOLD);

    // When
    const promiseA = readable.read(0n, 100n);
    const promiseB = readable.read(bOffset, 100n);
    const [dataA, dataB] = await Promise.all([promiseA, promiseB]);

    // Then
    expect(inner.read).toHaveBeenCalledTimes(1);
    expect(inner.read).toHaveBeenCalledWith(0n, bOffset + 100n);
    expect(dataA).toEqual(expectedBytes(0n, 100n));
    expect(dataB).toEqual(expectedBytes(bOffset, 100n));
  });

  it("should NOT merge two reads whose gap is just over the threshold boundary", async () => {
    // Given
    const inner = makeMockInner(2n ** 40n);
    const readable = new BatchingReadable(inner);
    // Read A ends at offset 100. An offset of `100 + threshold + 1` fails the
    // `offset <= end + threshold` merge condition.
    const bOffset = BigInt(100 + DEFAULT_THRESHOLD + 1);

    // When
    const promiseA = readable.read(0n, 100n);
    const promiseB = readable.read(bOffset, 100n);
    const [dataA, dataB] = await Promise.all([promiseA, promiseB]);

    // Then
    expect(inner.read).toHaveBeenCalledTimes(2);
    expect(inner.read).toHaveBeenCalledWith(0n, 100n);
    expect(inner.read).toHaveBeenCalledWith(bOffset, 100n);
    expect(dataA).toEqual(expectedBytes(0n, 100n));
    expect(dataB).toEqual(expectedBytes(bOffset, 100n));
  });

  it("should not merge two distant reads far beyond the threshold", async () => {
    // Given
    const inner = makeMockInner(2n ** 40n);
    const readable = new BatchingReadable(inner);
    const bOffset = BigInt(DEFAULT_THRESHOLD) * 10n;

    // When
    const promiseA = readable.read(0n, 50n);
    const promiseB = readable.read(bOffset, 50n);
    const [dataA, dataB] = await Promise.all([promiseA, promiseB]);

    // Then
    expect(inner.read).toHaveBeenCalledTimes(2);
    expect(inner.read).toHaveBeenCalledWith(0n, 50n);
    expect(inner.read).toHaveBeenCalledWith(bOffset, 50n);
    expect(dataA).toEqual(expectedBytes(0n, 50n));
    expect(dataB).toEqual(expectedBytes(bOffset, 50n));
  });

  it("should honor a custom gapThresholdBytes option that prevents merging", async () => {
    // Given
    const inner = makeMockInner();
    const readable = new BatchingReadable(inner, { gapThresholdBytes: 8n });
    // Read A ends at offset 4; B is 9 bytes away, which exceeds the custom
    // threshold of 8 (but would be merged under the default threshold).
    const bOffset = 13n;

    // When
    const promiseA = readable.read(0n, 4n);
    const promiseB = readable.read(bOffset, 4n);
    const [dataA, dataB] = await Promise.all([promiseA, promiseB]);

    // Then
    expect(inner.read).toHaveBeenCalledTimes(2);
    expect(inner.read).toHaveBeenCalledWith(0n, 4n);
    expect(inner.read).toHaveBeenCalledWith(bOffset, 4n);
    expect(dataA).toEqual(expectedBytes(0n, 4n));
    expect(dataB).toEqual(expectedBytes(bOffset, 4n));
  });

  it("should coalesce overlapping reads into one inner.read and slice each range correctly", async () => {
    // Given
    const inner = makeMockInner();
    const readable = new BatchingReadable(inner);

    // When - ranges [0, 100) and [50, 150) overlap
    const promiseA = readable.read(0n, 100n);
    const promiseB = readable.read(50n, 100n);
    const [dataA, dataB] = await Promise.all([promiseA, promiseB]);

    // Then
    expect(inner.read).toHaveBeenCalledTimes(1);
    expect(inner.read).toHaveBeenCalledWith(0n, 150n);
    expect(dataA).toEqual(expectedBytes(0n, 100n));
    expect(dataB).toEqual(expectedBytes(50n, 100n));
  });

  it("should reject all members of a group when its inner.read rejects", async () => {
    // Given
    const error = new Error("read failed");
    const inner = makeMockInner();
    inner.read.mockRejectedValueOnce(error);
    const readable = new BatchingReadable(inner);

    // When - two adjacent reads share a single (failing) group
    const promiseA = readable.read(0n, 100n);
    const promiseB = readable.read(200n, 100n);

    // Then
    await expect(promiseA).rejects.toThrow("read failed");
    await expect(promiseB).rejects.toThrow("read failed");
    expect(inner.read).toHaveBeenCalledTimes(1);
  });

  it("should isolate a failing group from a succeeding group in the same flush", async () => {
    // Given
    const error = new Error("group A failed");
    const inner = makeMockInner(2n ** 40n);
    const farOffset = BigInt(DEFAULT_THRESHOLD) * 10n;
    inner.read.mockImplementation(async (offset: bigint, size: bigint): Promise<Uint8Array> => {
      if (offset === 0n) {
        throw error;
      }
      return expectedBytes(offset, size);
    });
    const readable = new BatchingReadable(inner);

    // When - group A (offset 0) fails; group B (far offset) succeeds
    const promiseA = readable.read(0n, 100n);
    const promiseB = readable.read(farOffset, 100n);

    // Then
    await expect(promiseA).rejects.toThrow("group A failed");
    await expect(promiseB).resolves.toEqual(expectedBytes(farOffset, 100n));
    expect(inner.read).toHaveBeenCalledTimes(2);
  });

  it("should not coalesce reads that arrive in separate microtask ticks", async () => {
    // Given
    const inner = makeMockInner();
    const readable = new BatchingReadable(inner);

    // When - the first read is awaited (its batch flushes) before the second
    const dataA = await readable.read(0n, 100n);
    const dataB = await readable.read(200n, 100n);

    // Then
    expect(inner.read).toHaveBeenCalledTimes(2);
    expect(inner.read).toHaveBeenNthCalledWith(1, 0n, 100n);
    expect(inner.read).toHaveBeenNthCalledWith(2, 200n, 100n);
    expect(dataA).toEqual(expectedBytes(0n, 100n));
    expect(dataB).toEqual(expectedBytes(200n, 100n));
  });

  it("should not merge reads whose combined span would exceed maxCoalescedBytes", async () => {
    // Given a small max span; the two reads are within the gap threshold but
    // together span more bytes than the cap allows.
    const inner = makeMockInner();
    const readable = new BatchingReadable(inner, { maxCoalescedBytes: 150n });
    // Read A ends at 100; B starts at 120 (gap 20 < default 64 KiB threshold),
    // but the merged span [0, 220) = 220 bytes exceeds the 150-byte cap.
    const bOffset = 120n;

    // When
    const promiseA = readable.read(0n, 100n);
    const promiseB = readable.read(bOffset, 100n);
    const [dataA, dataB] = await Promise.all([promiseA, promiseB]);

    // Then
    expect(inner.read).toHaveBeenCalledTimes(2);
    expect(inner.read).toHaveBeenCalledWith(0n, 100n);
    expect(inner.read).toHaveBeenCalledWith(bOffset, 100n);
    expect(dataA).toEqual(expectedBytes(0n, 100n));
    expect(dataB).toEqual(expectedBytes(bOffset, 100n));
  });

  it("should resolve copies that do not retain the full merged buffer", async () => {
    // Given two adjacent reads that coalesce into one 300-byte inner read
    const inner = makeMockInner();
    const readable = new BatchingReadable(inner);

    // When
    const promiseA = readable.read(0n, 100n);
    const promiseB = readable.read(200n, 100n);
    const [dataA, dataB] = await Promise.all([promiseA, promiseB]);

    // Then a single merged read happened, but each result owns a buffer sized to
    // its own slice (a copy), not the full 300-byte merged buffer.
    expect(inner.read).toHaveBeenCalledTimes(1);
    expect(inner.read).toHaveBeenCalledWith(0n, 300n);
    expect(dataA.byteLength).toBe(100);
    expect(dataB.byteLength).toBe(100);
    expect(dataA.buffer.byteLength).toBe(100);
    expect(dataB.buffer.byteLength).toBe(100);
    expect(dataA).toEqual(expectedBytes(0n, 100n));
    expect(dataB).toEqual(expectedBytes(200n, 100n));
  });
});
