// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { RemoteFileReadable } from "./RemoteFileReadable";

// Mock BrowserHttpReader and CachedFilelike so we never make real HTTP requests
const mockOpen = jest.fn().mockResolvedValue(undefined);
const mockSize = jest.fn().mockReturnValue(1024);
const mockRead = jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));

jest.mock("@lichtblick/suite-base/util/CachedFilelike", () => {
  return jest.fn().mockImplementation(() => ({
    open: mockOpen,
    size: mockSize,
    read: mockRead,
  }));
});

jest.mock("@lichtblick/suite-base/util/BrowserHttpReader", () => {
  return jest.fn();
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CachedFilelike = require("@lichtblick/suite-base/util/CachedFilelike");

describe("RemoteFileReadable", () => {
  const testUrl = "https://example.com/data.mcap";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should use default 500MiB cache size when none provided", () => {
      // Given a URL without custom cache size
      // When creating a RemoteFileReadable
      new RemoteFileReadable(testUrl);

      // Then CachedFilelike should be created with 500MiB default
      expect(CachedFilelike).toHaveBeenCalledWith(
        expect.objectContaining({ cacheSizeInBytes: 1024 * 1024 * 500 }),
      );
    });

    it("should use custom cache size when provided", () => {
      // Given a URL with a custom cache size
      const customSize = 1024 * 1024 * 100; // 100MiB

      // When creating a RemoteFileReadable
      new RemoteFileReadable(testUrl, customSize);

      // Then CachedFilelike should be created with the custom size
      expect(CachedFilelike).toHaveBeenCalledWith(
        expect.objectContaining({ cacheSizeInBytes: customSize }),
      );
    });
  });

  describe("open", () => {
    it("should delegate to CachedFilelike.open()", async () => {
      // Given a RemoteFileReadable instance
      const reader = new RemoteFileReadable(testUrl);

      // When calling open
      await reader.open();

      // Then it should delegate to the internal CachedFilelike
      expect(mockOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe("size", () => {
    it("should return file size as BigInt", async () => {
      // Given a RemoteFileReadable whose underlying CachedFilelike reports size 1024
      const reader = new RemoteFileReadable(testUrl);

      // When getting the size
      const result = await reader.size();

      // Then it should return the size as a BigInt
      expect(result).toBe(BigInt(1024));
    });
  });

  describe("read", () => {
    it("should delegate to CachedFilelike.read() converting BigInt to Number", async () => {
      // Given a RemoteFileReadable instance
      const reader = new RemoteFileReadable(testUrl);

      // When reading data with BigInt offset and size
      const result = await reader.read(BigInt(100), BigInt(50));

      // Then it should call CachedFilelike.read with Number values
      expect(mockRead).toHaveBeenCalledWith(100, 50);
      expect(result).toEqual(new Uint8Array([1, 2, 3]));
    });

    it("should throw when offset + size exceeds MAX_SAFE_INTEGER", async () => {
      // Given a RemoteFileReadable instance
      const reader = new RemoteFileReadable(testUrl);

      // When reading with offset + size > MAX_SAFE_INTEGER
      // Then it should throw
      await expect(reader.read(BigInt(Number.MAX_SAFE_INTEGER), BigInt(1))).rejects.toThrow(
        "Read too large",
      );
    });
  });
});
