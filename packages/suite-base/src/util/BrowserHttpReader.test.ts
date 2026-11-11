// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

import BrowserHttpReader from "./BrowserHttpReader";

jest.mock("@lichtblick/suite-base/util/isDesktopApp", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockIsDesktop = isDesktopApp as jest.MockedFunction<typeof isDesktopApp>;
const url = "https://example.com/data.mcap";

function rangedResponse(
  init: { status?: number; headers?: Record<string, string>; cancelSpy?: jest.Mock } = {},
): Response {
  const response = new Response(new Uint8Array([0]), {
    status: init.status ?? 206,
    headers: init.headers,
  });
  if (init.cancelSpy) {
    Object.defineProperty(response, "body", {
      value: { cancel: init.cancelSpy },
    });
  }
  return response;
}

describe("BrowserHttpReader", () => {
  let mockFetch: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = jest.spyOn(global, "fetch");
    mockIsDesktop.mockReturnValue(false);
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  describe("open() ranged size probe (fast path)", () => {
    it("resolves size and identifier from Content-Range on a 206 response without a fallback request", async () => {
      mockFetch.mockResolvedValue(
        rangedResponse({
          headers: { "content-range": "bytes 0-0/12345", etag: "abc123" },
        }),
      );

      const reader = new BrowserHttpReader(url);
      const result = await reader.open();

      expect(result).toEqual({ size: 12345, identifier: "abc123" });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        url,
        expect.objectContaining({ headers: { range: "bytes=0-0" }, cache: "no-store" }),
      );
    });

    it("falls back to last-modified when etag is absent", async () => {
      mockFetch.mockResolvedValue(
        rangedResponse({
          headers: { "content-range": "bytes 0-0/999", "last-modified": "Mon, 01 Jan 2026" },
        }),
      );

      const result = await new BrowserHttpReader(url).open();

      expect(result).toEqual({ size: 999, identifier: "Mon, 01 Jan 2026" });
    });

    it("consumes the one-byte body of a successful ranged probe", async () => {
      const response = rangedResponse({ headers: { "content-range": "bytes 0-0/12345" } });
      mockFetch.mockResolvedValue(response);

      await new BrowserHttpReader(url).open();

      expect(response.bodyUsed).toBe(true);
    });
  });

  describe("open() same-origin edge ranges", () => {
    const size = 200;
    const tailBytes = new Uint8Array(100).fill(2);
    const headBytes = new Uint8Array(100).fill(1);

    function edgeResponse(
      data: Uint8Array<ArrayBuffer>,
      contentRange: string,
      etag = "abc",
    ): Response {
      return new Response(data, {
        status: 206,
        headers: { "content-range": contentRange, etag },
      });
    }

    beforeEach(() => {
      Object.defineProperty(globalThis, "location", {
        value: { origin: "https://example.com" },
        configurable: true,
      });
    });

    afterEach(() => {
      Reflect.deleteProperty(globalThis, "location");
    });

    it("returns the size and prefetched head and tail from two parallel ranged requests", async () => {
      // Given a same-origin server answering the tail and head ranges
      mockFetch
        .mockResolvedValueOnce(edgeResponse(tailBytes, `bytes 100-199/${size}`))
        .mockResolvedValueOnce(edgeResponse(headBytes, `bytes 0-99/${size}`));

      // When opening
      const result = await new BrowserHttpReader(url).open();

      // Then the size and both ranges come back without any other request
      expect(result).toEqual({
        size,
        identifier: "abc",
        prefetched: [
          { offset: 100, data: tailBytes },
          { offset: 0, data: headBytes },
        ],
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        url,
        expect.objectContaining({ headers: { range: "bytes=-65536" } }),
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        url,
        expect.objectContaining({ headers: { range: "bytes=0-65535" } }),
      );
    });

    it("drops the head when its identifier differs from the tail", async () => {
      // Given a head response from a different file version
      mockFetch
        .mockResolvedValueOnce(edgeResponse(tailBytes, `bytes 100-199/${size}`, "v1"))
        .mockResolvedValueOnce(edgeResponse(headBytes, `bytes 0-99/${size}`, "v2"));

      // When opening
      const result = await new BrowserHttpReader(url).open();

      // Then only the tail is prefetched
      expect(result.prefetched).toEqual([{ offset: 100, data: tailBytes }]);
    });

    it("falls back to the one-byte probe when the tail request is not a 206", async () => {
      // Given a server that ignores the suffix range
      mockFetch
        .mockResolvedValueOnce(rangedResponse({ status: 200 }))
        .mockResolvedValueOnce(edgeResponse(headBytes, `bytes 0-99/${size}`))
        .mockResolvedValueOnce(
          rangedResponse({ headers: { "content-range": `bytes 0-0/${size}` } }),
        );

      // When opening
      const result = await new BrowserHttpReader(url).open();

      // Then the size comes from the one-byte probe, with nothing prefetched
      expect(result).toEqual({ size, identifier: undefined });
      expect(mockFetch).toHaveBeenLastCalledWith(
        url,
        expect.objectContaining({ headers: { range: "bytes=0-0" } }),
      );
    });

    it("falls back when the tail body is shorter than its Content-Range", async () => {
      // Given a truncated tail response
      mockFetch
        .mockResolvedValueOnce(edgeResponse(new Uint8Array(10), `bytes 100-199/${size}`))
        .mockResolvedValueOnce(edgeResponse(headBytes, `bytes 0-99/${size}`))
        .mockResolvedValueOnce(
          rangedResponse({ headers: { "content-range": `bytes 0-0/${size}` } }),
        );

      // When opening
      const result = await new BrowserHttpReader(url).open();

      // Then the incomplete data is not used
      expect(result.prefetched).toBeUndefined();
      expect(result.size).toBe(size);
    });

    it("uses only the one-byte probe for cross-origin URLs", async () => {
      // Given a URL on another origin
      mockFetch.mockResolvedValueOnce(
        rangedResponse({ headers: { "content-range": `bytes 0-0/${size}` } }),
      );

      // When opening
      await new BrowserHttpReader("https://other.example.org/data.mcap").open();

      // Then no suffix range is requested
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://other.example.org/data.mcap",
        expect.objectContaining({ headers: { range: "bytes=0-0" } }),
      );
    });
  });

  describe("open() fallback to full-GET-then-abort probe", () => {
    it("falls back when the server ignores the Range header (status 200)", async () => {
      const cancelSpy = jest.fn().mockResolvedValue(undefined);
      mockFetch
        .mockResolvedValueOnce(rangedResponse({ status: 200, cancelSpy }))
        .mockResolvedValueOnce(
          new Response(null, {
            status: 200,
            headers: { "accept-ranges": "bytes", "content-length": "500" },
          }),
        );

      const result = await new BrowserHttpReader(url).open();

      expect(result).toEqual({ size: 500, identifier: undefined });
      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("falls back when the 206 response has no Content-Range header", async () => {
      mockFetch.mockResolvedValueOnce(rangedResponse({ headers: {} })).mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { "accept-ranges": "bytes", "content-length": "500" },
        }),
      );

      const result = await new BrowserHttpReader(url).open();

      expect(result.size).toBe(500);
    });

    it("falls back when Content-Range is present but unparsable", async () => {
      mockFetch
        .mockResolvedValueOnce(rangedResponse({ headers: { "content-range": "bytes */*" } }))
        .mockResolvedValueOnce(
          new Response(null, {
            status: 200,
            headers: { "accept-ranges": "bytes", "content-length": "500" },
          }),
        );

      const result = await new BrowserHttpReader(url).open();

      expect(result.size).toBe(500);
    });

    it("falls back when the ranged probe request throws", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network down")).mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { "accept-ranges": "bytes", "content-length": "500" },
        }),
      );

      const result = await new BrowserHttpReader(url).open();

      expect(result.size).toBe(500);
    });
  });

  describe("open() fallback probe error handling (unchanged pre-existing behavior)", () => {
    beforeEach(() => {
      // Every test in this block exercises the fallback path, so make the ranged probe a no-op miss.
      mockFetch.mockResolvedValueOnce(rangedResponse({ status: 200 }));
    });

    it("throws when the fallback fetch itself fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("boom"));

      await expect(new BrowserHttpReader(url).open()).rejects.toThrow(
        "Fetching remote file failed",
      );
    });

    it("includes a CORS hint in the browser (non-desktop) error message", async () => {
      mockIsDesktop.mockReturnValue(false);
      mockFetch.mockRejectedValueOnce(new Error("boom"));

      await expect(new BrowserHttpReader(url).open()).rejects.toThrow(/CORS/);
    });

    it("throws when the fallback response is not ok", async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

      await expect(new BrowserHttpReader(url).open()).rejects.toThrow("Status code: 404");
    });

    it("throws when accept-ranges is missing from the fallback response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 200, headers: { "content-length": "500" } }),
      );

      await expect(new BrowserHttpReader(url).open()).rejects.toThrow(
        "Support for HTTP Range requests was not detected",
      );
    });

    it("throws when content-length is missing from the fallback response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 200, headers: { "accept-ranges": "bytes" } }),
      );

      await expect(new BrowserHttpReader(url).open()).rejects.toThrow(
        "Remote file is missing file size",
      );
    });
  });

  describe("fetch()", () => {
    it("issues a ranged request for the requested offset/length", () => {
      const reader = new BrowserHttpReader(url);
      const stream = reader.fetch(10, 20);

      expect(stream).toBeDefined();
    });
  });
});
