// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { McapTypes } from "@mcap/core";

import { FooterPrefetchingReadable } from "./FooterPrefetchingReadable";

const FOOTER_LENGTH = 37n;

describe("FooterPrefetchingReadable", () => {
  describe("size()", () => {
    it("returns the inner size unchanged", async () => {
      // Given
      const inner: McapTypes.IReadable = {
        size: jest.fn().mockResolvedValue(1000n),
        read: jest.fn().mockResolvedValue(new Uint8Array(0)),
      };
      const readable = new FooterPrefetchingReadable(inner);

      // When
      const size = await readable.size();

      // Then
      expect(size).toBe(1000n);
    });

    it("speculatively starts reading the footer region as soon as size() resolves", async () => {
      // Given
      const read = jest.fn().mockResolvedValue(new Uint8Array(Number(FOOTER_LENGTH)));
      const inner: McapTypes.IReadable = { size: jest.fn().mockResolvedValue(1000n), read };
      const readable = new FooterPrefetchingReadable(inner);

      // When
      await readable.size();

      // Then: the footer read was already kicked off (not just planned) after size() alone.
      expect(read).toHaveBeenCalledTimes(1);
      expect(read).toHaveBeenCalledWith(1000n - FOOTER_LENGTH, FOOTER_LENGTH);
    });

    it("only starts the speculative footer read once, even if size() is called multiple times", async () => {
      // Given
      const read = jest.fn().mockResolvedValue(new Uint8Array(Number(FOOTER_LENGTH)));
      const inner: McapTypes.IReadable = { size: jest.fn().mockResolvedValue(1000n), read };
      const readable = new FooterPrefetchingReadable(inner);

      // When
      await readable.size();
      await readable.size();
      await readable.size();

      // Then
      expect(read).toHaveBeenCalledTimes(1);
    });

    it("does not speculate when the file is smaller than a footer record", async () => {
      // Given: a file too small to even hold a footer record.
      const read = jest.fn().mockResolvedValue(new Uint8Array(0));
      const inner: McapTypes.IReadable = { size: jest.fn().mockResolvedValue(10n), read };
      const readable = new FooterPrefetchingReadable(inner);

      // When
      await readable.size();

      // Then: no premature/negative-offset read is attempted.
      expect(read).not.toHaveBeenCalled();
    });

    it("does not raise an unhandled rejection when the speculative footer read fails and is never consumed", async () => {
      // Given: the speculative footer read itself fails.
      const read = jest.fn().mockRejectedValue(new Error("network error"));
      const inner: McapTypes.IReadable = { size: jest.fn().mockResolvedValue(1000n), read };
      const readable = new FooterPrefetchingReadable(inner);

      // When/Then: size() itself still resolves normally, and doesn't throw.
      await expect(readable.size()).resolves.toBe(1000n);
    });
  });

  describe("read()", () => {
    it("serves the exact prefetched footer range from the speculative read, without calling the inner reader again", async () => {
      // Given: size() has already kicked off the speculative footer prefetch.
      const footerData = new Uint8Array(Number(FOOTER_LENGTH)).fill(7);
      const read = jest.fn().mockResolvedValue(footerData);
      const inner: McapTypes.IReadable = { size: jest.fn().mockResolvedValue(1000n), read };
      const readable = new FooterPrefetchingReadable(inner);
      await readable.size();
      read.mockClear();

      // When: the caller (mimicking McapIndexedReader.Initialize()) requests exactly that range.
      const result = await readable.read(1000n - FOOTER_LENGTH, FOOTER_LENGTH);

      // Then: the prefetched data is returned directly, no new underlying read is issued.
      expect(result).toBe(footerData);
      expect(read).not.toHaveBeenCalled();
    });

    it("falls back to a normal read for any range other than the prefetched footer", async () => {
      // Given
      const headerData = new Uint8Array([1, 2, 3]);
      const read = jest
        .fn()
        .mockResolvedValueOnce(new Uint8Array(Number(FOOTER_LENGTH))) // the speculative footer read
        .mockResolvedValueOnce(headerData); // the caller's actual header read
      const inner: McapTypes.IReadable = { size: jest.fn().mockResolvedValue(1000n), read };
      const readable = new FooterPrefetchingReadable(inner);
      await readable.size();

      // When: the caller requests the file header instead (a completely different range).
      const result = await readable.read(0n, 20n);

      // Then: falls through to the inner reader for this (non-footer) range.
      expect(result).toBe(headerData);
      expect(read).toHaveBeenLastCalledWith(0n, 20n);
    });

    it("propagates a real error from the prefetched footer read when the caller does request that range", async () => {
      // Given
      const error = new Error("range fetch failed");
      const read = jest.fn().mockRejectedValue(error);
      const inner: McapTypes.IReadable = { size: jest.fn().mockResolvedValue(1000n), read };
      const readable = new FooterPrefetchingReadable(inner);
      await readable.size();

      // When/Then: requesting the exact prefetched range surfaces the real error.
      await expect(readable.read(1000n - FOOTER_LENGTH, FOOTER_LENGTH)).rejects.toThrow(
        "range fetch failed",
      );
    });

    it("still works correctly if read() is called before size() (no prefetch in flight)", async () => {
      // Given: no speculative prefetch has been started yet.
      const data = new Uint8Array([9, 9, 9]);
      const read = jest.fn().mockResolvedValue(data);
      const inner: McapTypes.IReadable = { size: jest.fn().mockResolvedValue(1000n), read };
      const readable = new FooterPrefetchingReadable(inner);

      // When
      const result = await readable.read(0n, 3n);

      // Then
      expect(result).toBe(data);
      expect(read).toHaveBeenCalledWith(0n, 3n);
    });
  });
});
