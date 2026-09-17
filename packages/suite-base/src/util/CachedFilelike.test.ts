// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import delay from "@lichtblick/suite-base/util/delay";

import CachedFilelike from "./CachedFilelike";
import type { FileReader, FileStream } from "./CachedFilelike.types";

const MEBIBYTE = 1024 * 1024;

class InMemoryFileReader implements FileReader {
  #buffer: Uint8Array;

  public constructor(bufferObj: Uint8Array) {
    this.#buffer = bufferObj;
  }

  public async open() {
    return { size: this.#buffer.byteLength };
  }

  public fetch(offset: number, length: number): FileStream {
    if (offset + length > this.#buffer.byteLength) {
      throw new Error(
        `Read offset=${offset} length=${length} past buffer length ${this.#buffer.byteLength}`,
      );
    }
    return {
      on: (
        type: "data" | "error" | "end",
        callback: ((_: Uint8Array) => void) & ((_: Error) => void) & (() => void),
      ) => {
        if (type === "data") {
          setTimeout(() => {
            callback(this.#buffer.slice(offset, offset + length));
          }, 0);
        }
      },
      destroy() {
        // no-op
      },
    };
  }
}

const log = {
  debug: (..._args: unknown[]) => {},
  info: (..._args: unknown[]) => {},
  warn: (..._args: unknown[]) => {},
  error: (..._args: unknown[]) => {},
};

describe("CachedFilelike", () => {
  describe("#size", () => {
    it("returns the size from the underlying FileReader", async () => {
      const fileReader = new InMemoryFileReader(new Uint8Array([0, 1, 2, 3]));
      const cachedFileReader = new CachedFilelike({ fileReader, log });
      await cachedFileReader.open();
      expect(cachedFileReader.size()).toEqual(4);
    });

    it("does not throw when the size is 0", async () => {
      const fileReader = new InMemoryFileReader(new Uint8Array([]));
      const cachedFileReader = new CachedFilelike({ fileReader, log });
      await cachedFileReader.open();
      expect(cachedFileReader.size()).toEqual(0);
    });
  });

  describe("#read", () => {
    it("returns data from the underlying FileReader", async () => {
      const fileReader = new InMemoryFileReader(new Uint8Array([0, 1, 2, 3]));
      const cachedFileReader = new CachedFilelike({ fileReader, log });
      await expect(cachedFileReader.read(1, 2)).resolves.toEqual(new Uint8Array([1, 2]));
      await expect(cachedFileReader.read(2, 2)).resolves.toEqual(new Uint8Array([2, 3]));
    });

    it("requests only the exact range when read-ahead is disabled", async () => {
      // GIVEN: a file that fits entirely in the cache.
      const fileReader = new InMemoryFileReader(new Uint8Array(100));
      const fetch = jest.spyOn(fileReader, "fetch");
      const cachedFileReader = new CachedFilelike({
        fileReader,
        cacheSizeInBytes: 100,
        readAheadEnabled: false,
        log,
      });

      // WHEN: reading a small range.
      await expect(cachedFileReader.read(0, 10)).resolves.toEqual(new Uint8Array(10));

      // THEN: no speculative whole-file or look-ahead fetch is made.
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(0, 10);
    });

    it("bounds speculative fetch length with readAheadBufferBytes", async () => {
      // GIVEN: a large remote-like file with a small cache budget and a much smaller read-ahead cap.
      const readAheadBufferBytes = 2 * 1024 * 1024;
      const fetch = jest.fn(
        (_offset: number, length: number): FileStream => ({
          on: (
            type: "data" | "error" | "end",
            callback: ((_: Uint8Array) => void) & ((_: Error) => void) & (() => void),
          ) => {
            if (type === "data") {
              setTimeout(() => {
                callback(new Uint8Array(length));
              }, 0);
            }
          },
          destroy() {
            // no-op
          },
        }),
      );
      const fileReader: FileReader = {
        open: async () => ({ size: 100 * 1024 * 1024 }),
        fetch,
      };
      const cachedFileReader = new CachedFilelike({
        fileReader,
        cacheSizeInBytes: 10 * 1024 * 1024,
        readAheadBufferBytes,
        log,
      });

      // WHEN: reading a small initial range.
      await expect(cachedFileReader.read(0, 1024)).resolves.toEqual(new Uint8Array(1024));

      // THEN: the initial underlying fetch uses the bounded read-ahead size instead of 50 MiB.
      expect(fetch).toHaveBeenNthCalledWith(1, 0, readAheadBufferBytes);
    });

    it("resolves a later overlapping read instead of hanging when a small read-ahead buffer trails cached bytes", async () => {
      // GIVEN: a file where an earlier 2 MiB speculative fetch is still in flight when a later
      // 4 MiB read arrives, matching the production hang scenario exposed by a 2 MiB buffer.
      const fetch = jest.fn(
        (_offset: number, length: number): FileStream => ({
          on: (
            type: "data" | "error" | "end",
            callback: ((_: Uint8Array) => void) & ((_: Error) => void) & (() => void),
          ) => {
            if (type === "data") {
              setTimeout(() => {
                callback(new Uint8Array(length));
              }, 25);
            }
          },
          destroy() {
            // no-op
          },
        }),
      );
      const fileReader: FileReader = {
        open: async () => ({ size: 8 * MEBIBYTE }),
        fetch,
      };
      const cachedFileReader = new CachedFilelike({
        fileReader,
        cacheSizeInBytes: 6 * MEBIBYTE,
        readAheadBufferBytes: 2 * MEBIBYTE,
        log,
      });

      const firstReadPromise = cachedFileReader.read(0, 1);
      await delay(10);
      expect(fetch).toHaveBeenCalledTimes(1);

      // WHEN: a larger overlapping read needs bytes beyond the already cached 2 MiB prefix.
      const secondReadPromise = cachedFileReader.read(0, 4 * MEBIBYTE);

      // THEN: the second fetch makes forward progress by requesting the missing 2 MiB tail
      // instead of issuing a degenerate 2 MiB-2 MiB range and hanging forever.
      await expect(firstReadPromise).resolves.toEqual(new Uint8Array([0]));
      await expect(secondReadPromise).resolves.toEqual(new Uint8Array(4 * MEBIBYTE));
      expect(fetch.mock.calls.slice(0, 2)).toEqual([
        [0, 2 * MEBIBYTE],
        [2 * MEBIBYTE, 2 * MEBIBYTE],
      ]);
    }, 2000);

    it("ignores a degenerate zero-width idle connection instead of fetching it", async () => {
      jest.resetModules();
      const getNewConnection = jest
        .fn()
        .mockReturnValueOnce({ start: 0, end: 4 })
        .mockReturnValueOnce({ start: 4, end: 4 })
        .mockReturnValue(undefined);
      jest.doMock("./getNewConnection", () => ({
        getNewConnection,
      }));
      const { default: MockedCachedFilelike } = await import("./CachedFilelike");

      const fileReader = new InMemoryFileReader(new Uint8Array([0, 1, 2, 3]));
      const fetch = jest.spyOn(fileReader, "fetch");
      const debug = jest.fn();
      const cachedFileReader = new MockedCachedFilelike({
        fileReader,
        log: { ...log, debug },
      });

      try {
        await expect(cachedFileReader.read(0, 4)).resolves.toEqual(new Uint8Array([0, 1, 2, 3]));
        await delay(10);

        expect(getNewConnection).toHaveBeenCalledTimes(2);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(0, 4);
        expect(debug).toHaveBeenCalledWith(expect.stringContaining("Ignoring degenerate"));
      } finally {
        jest.dontMock("./getNewConnection");
        jest.resetModules();
      }
    });

    it("reads the exact range uncached when a single read exceeds the cache size", async () => {
      // GIVEN: a source allocated a small cache (mirrors a many-file remote session where each
      // source receives only the 10 MiB minimum floor) backed by a larger file.
      const sourceData = Uint8Array.from({ length: 100 }, (_, index) => index);
      const fileReader = new InMemoryFileReader(sourceData);
      const cachedFileReader = new CachedFilelike({ fileReader, cacheSizeInBytes: 10, log });

      // WHEN: a chunk read is larger than the cache.
      const result = await cachedFileReader.read(0, 20);

      // THEN: the exact bytes are returned via the uncached path.
      expect(result).toEqual(sourceData.slice(0, 20));
    });

    it("rejects when an uncached read exceeds the file size", async () => {
      // GIVEN: a small file and a cache smaller than the requested read.
      const fileReader = new InMemoryFileReader(new Uint8Array(10));
      const cachedFileReader = new CachedFilelike({ fileReader, cacheSizeInBytes: 5, log });

      // WHEN/THEN: an oversized read that extends past EOF still rejects with the normal
      // out-of-bounds error.
      await expect(cachedFileReader.read(0, 1000)).rejects.toThrow("CachedFilelike#read past size");
    });

    it("returns an error in the callback if the FileReader keeps returning errors", async () => {
      const fileReader = new InMemoryFileReader(new Uint8Array([0, 1, 2, 3]));
      let interval: any;
      let destroyed: any;
      jest.spyOn(fileReader, "fetch").mockImplementation(() => {
        return {
          on: (
            type: "data" | "error" | "end",
            callback: ((_: Uint8Array) => void) & ((_: Error) => void) & (() => void),
          ) => {
            if (type === "error") {
              interval = setInterval(() => {
                callback(new Error("Dummy error"));
              }, 20);
            }
          },
          destroy() {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            clearInterval(interval);
            destroyed = true;
          },
        };
      });
      const cachedFileReader = new CachedFilelike({ fileReader, log });
      await expect(cachedFileReader.read(1, 2)).rejects.toThrow("Dummy error");
      expect(destroyed).toEqual(true);
    });

    it("keeps reconnecting when keepReconnectingCallback is set", async () => {
      const fileReader = new InMemoryFileReader(new Uint8Array([0, 1, 2, 3]));
      let dataCallback: ((_: Uint8Array) => void) | undefined;
      let errorCallback: ((_: Error) => void) | undefined;
      let destroyed: any;
      const mockFetch = jest.spyOn(fileReader, "fetch").mockImplementation(() => {
        return {
          on: (
            type: "data" | "error" | "end",
            callback: ((_: Uint8Array) => void) & ((_: Error) => void) & (() => void),
          ) => {
            if (type === "data") {
              dataCallback = callback;
            }
            if (type === "error") {
              errorCallback = callback;
            }
          },
          destroy() {
            destroyed = true;
          },
        };
      });

      const keepReconnectingCallback = jest.fn();
      const cachedFileReader = new CachedFilelike({ fileReader, log, keepReconnectingCallback });

      const readerPromise = cachedFileReader.read(1, 2);

      await delay(10);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      if (!dataCallback || !errorCallback) {
        throw new Error("dataCallback not set");
      }
      errorCallback(new Error("Dummy error"));
      await delay(10);
      expect(keepReconnectingCallback.mock.calls).toEqual([[true]]);

      dataCallback(new Uint8Array([1, 2]));
      const data = await readerPromise;
      expect(keepReconnectingCallback.mock.calls).toEqual([[true], [false]]);
      expect([...data]).toEqual([1, 2]);
      expect(destroyed).toBe(true);
    });

    it("returns an empty buffer when requesting size 0 (does not throw an error)", async () => {
      const fileReader = new InMemoryFileReader(new Uint8Array([0, 1, 2, 3]));
      const cachedFileReader = new CachedFilelike({ fileReader, log });
      await expect(cachedFileReader.read(1, 0)).resolves.toEqual(new Uint8Array([]));
    });

    it("rejects instead of hanging when a cached connection ends before the requested range is fully downloaded", async () => {
      // GIVEN: a cached read whose underlying stream ends early twice in a row.
      const fetch = jest.fn(
        (_offset: number, length: number): FileStream => ({
          on: (
            type: "data" | "error" | "end",
            callback: ((_: Uint8Array) => void) & ((_: Error) => void) & (() => void),
          ) => {
            if (type === "data" && length > 1) {
              setTimeout(() => {
                callback(new Uint8Array(length - 1));
              }, 0);
            }
            if (type === "end") {
              setTimeout(() => {
                callback();
              }, 1);
            }
          },
          destroy() {
            // no-op
          },
        }),
      );
      const fileReader: FileReader = {
        open: async () => ({ size: 100 }),
        fetch,
      };
      const cachedFileReader = new CachedFilelike({
        fileReader,
        readAheadEnabled: false,
        log,
      });

      // WHEN / THEN: the read rejects after the early EOF retry path rather than staying
      // pending forever with no further network activity.
      await expect(cachedFileReader.read(0, 10)).rejects.toThrow(/ended before download completed/);
      expect(fetch).toHaveBeenCalledTimes(2);
    }, 1000);
  });

  describe("#close", () => {
    it("rejects reads after close()", async () => {
      // GIVEN: an opened reader.
      const fileReader = new InMemoryFileReader(new Uint8Array([0, 1, 2, 3]));
      const cachedFileReader = new CachedFilelike({ fileReader, log });
      await cachedFileReader.open();

      // WHEN: the reader is closed.
      cachedFileReader.close();

      // THEN: subsequent reads reject with the closed error.
      await expect(cachedFileReader.read(0, 2)).rejects.toThrow("CachedFilelike is closed");
    });

    it("is idempotent when called twice", () => {
      // GIVEN: a reader.
      const fileReader = new InMemoryFileReader(new Uint8Array([0, 1, 2, 3]));
      const cachedFileReader = new CachedFilelike({ fileReader, log });

      // WHEN/THEN: closing twice does not throw.
      expect(() => {
        cachedFileReader.close();
        cachedFileReader.close();
      }).not.toThrow();
    });

    it("rejects an in-flight pending read request", async () => {
      // GIVEN: a file reader whose fetch never delivers data, so the read stays pending.
      const fileReader = new InMemoryFileReader(new Uint8Array([0, 1, 2, 3]));
      jest.spyOn(fileReader, "fetch").mockImplementation(() => ({
        on: () => {
          // Never emits "data" or "error", leaving the read request pending.
        },
        destroy() {
          // no-op
        },
      }));
      const cachedFileReader = new CachedFilelike({ fileReader, log });

      // WHEN: a read is started (and stays pending) and then the reader is closed.
      const readPromise = cachedFileReader.read(0, 2);
      await delay(10);
      cachedFileReader.close();

      // THEN: the pending read rejects with the closed error.
      await expect(readPromise).rejects.toThrow("CachedFilelike is closed");
    });

    it("rejects an oversized uncached read when closed", async () => {
      // GIVEN: a small cache and a fetch that never delivers data, so an oversized (uncached)
      // read stays pending.
      const fileReader = new InMemoryFileReader(new Uint8Array(100));
      jest.spyOn(fileReader, "fetch").mockImplementation(() => ({
        on: () => {
          // Never emits "data", "end", or "error", leaving the uncached read pending.
        },
        destroy() {
          // no-op
        },
      }));
      const cachedFileReader = new CachedFilelike({ fileReader, cacheSizeInBytes: 10, log });
      await cachedFileReader.open();

      // WHEN: an oversized read (larger than the cache budget) is started, then the reader closes.
      const readPromise = cachedFileReader.read(0, 50);
      await delay(10);
      cachedFileReader.close();

      // THEN: the oversized uncached read settles by rejecting with the closed error.
      await expect(readPromise).rejects.toThrow("CachedFilelike is closed");
    });

    it("destroys the active connection when two quick stream errors trigger the fatal close path", async () => {
      // GIVEN: a read that reconnects once and then hits the fatal double-error close path.
      const fileReader = new InMemoryFileReader(new Uint8Array([0, 1, 2, 3]));
      const streams: Array<{ destroy: jest.Mock; error?: (_error: Error) => void }> = [];
      jest.spyOn(fileReader, "fetch").mockImplementation(() => {
        const stream = { destroy: jest.fn() };
        streams.push(stream);
        return {
          on: (
            type: "data" | "error" | "end",
            callback: ((_: Uint8Array) => void) & ((_: Error) => void) & (() => void),
          ) => {
            if (type === "error") {
              streams[streams.length - 1]!.error = callback;
            }
          },
          destroy: stream.destroy,
        };
      });
      let now = 1_000;
      const dateNow = jest.spyOn(Date, "now").mockImplementation(() => now);
      const cachedFileReader = new CachedFilelike({ fileReader, log });

      try {
        // WHEN: two connection errors happen within the fatal 100ms window.
        const readPromise = cachedFileReader.read(0, 2);
        await delay(10);

        now = 1_010;
        streams[0]!.error?.(new Error("transient"));
        await delay(10);

        now = 1_050;
        const fatalError = new Error("fatal");
        streams[1]!.error?.(fatalError);

        // THEN: the read rejects, and the active connection is destroyed as part of full cleanup.
        await expect(readPromise).rejects.toThrow("fatal");
        expect(streams[1]!.destroy).toHaveBeenCalledTimes(1);
      } finally {
        dateNow.mockRestore();
      }
    });
  });

  describe("multi-connection support (maxConcurrentConnections)", () => {
    // A fetch mock whose emitted data is delayed by a configurable amount per call, so tests can
    // control which connections are still in-flight when a later read arrives.
    function makeControllableFetch(delayMs: number) {
      const streams: { destroy: jest.Mock }[] = [];
      const fetch = jest.fn((_offset: number, length: number): FileStream => {
        const destroy = jest.fn();
        streams.push({ destroy });
        return {
          on: (
            type: "data" | "error" | "end",
            callback: ((_: Uint8Array) => void) & ((_: Error) => void) & (() => void),
          ) => {
            if (type === "data") {
              setTimeout(() => {
                callback(new Uint8Array(length));
              }, delayMs);
            }
          },
          destroy,
        };
      });
      return { fetch, streams };
    }

    it("keeps a genuinely disjoint read's connection alive instead of tearing it down for a second one", async () => {
      // GIVEN: a large file, room for 2 concurrent connections, and a slow first fetch that is
      // still in flight when a second, disjoint read arrives.
      const { fetch, streams } = makeControllableFetch(30);
      const fileReader: FileReader = { open: async () => ({ size: 20 * MEBIBYTE }), fetch };
      const cachedFileReader = new CachedFilelike({
        fileReader,
        cacheSizeInBytes: 4 * MEBIBYTE,
        readAheadEnabled: false,
        maxConcurrentConnections: 2,
        log,
      });

      // WHEN: the first (slow) read starts, then a disjoint second read starts before it settles.
      const firstReadPromise = cachedFileReader.read(0, 1024);
      await delay(5);
      const secondReadPromise = cachedFileReader.read(10 * MEBIBYTE, 1024);
      await delay(5);

      // THEN: both connections are open concurrently -- the first was NOT destroyed to make room
      // for the second.
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(streams[0]!.destroy).not.toHaveBeenCalled();

      // AND: both reads still resolve correctly once their data arrives.
      await expect(firstReadPromise).resolves.toEqual(new Uint8Array(1024));
      await expect(secondReadPromise).resolves.toEqual(new Uint8Array(1024));
    });

    it("evicts the farthest connection that isn't backing another still-pending request", async () => {
      // GIVEN: a manually-controlled fetch mock that lets the test decide exactly how many bytes
      // each connection has delivered so far -- needed to construct connections that have
      // already satisfied their *original* request (which is no longer pending) but are still
      // downloading their read-ahead-extended range, and are therefore free to evict.
      const emitters: Array<(bytes: number) => void> = [];
      const destroys: jest.Mock[] = [];
      const fetch = jest.fn((): FileStream => {
        let dataCallback: ((chunk: Uint8Array) => void) | undefined;
        const destroy = jest.fn();
        destroys.push(destroy);
        emitters.push((bytes: number) => dataCallback?.(new Uint8Array(bytes)));
        return {
          on: (
            type: "data" | "error" | "end",
            callback: ((_: Uint8Array) => void) & ((_: Error) => void) & (() => void),
          ) => {
            if (type === "data") {
              dataCallback = callback;
            }
          },
          destroy,
        };
      });
      const fileReader: FileReader = { open: async () => ({ size: 20 * MEBIBYTE }), fetch };
      const readAheadBufferBytes = 2000;
      const cachedFileReader = new CachedFilelike({
        fileReader,
        cacheSizeInBytes: 4 * MEBIBYTE, // < fileSize, so the small readAheadBufferBytes extension applies.
        readAheadBufferBytes,
        maxConcurrentConnections: 2,
        log,
      });

      // WHEN: connection A (near, @ 0) and connection B (far, @ 15 MiB) each fully satisfy their
      // own small request, but keep running to fill out their read-ahead-extended 2000-byte range.
      const nearReadPromise = cachedFileReader.read(0, 100);
      await delay(5);
      emitters[0]!(100); // satisfies the 100-byte request; connection A's 2000-byte range is not.
      await expect(nearReadPromise).resolves.toEqual(new Uint8Array(100));

      const farReadPromise = cachedFileReader.read(15 * MEBIBYTE, 100);
      await delay(5);
      emitters[1]!(100); // same for connection B.
      await expect(farReadPromise).resolves.toEqual(new Uint8Array(100));

      // Both original requests are now resolved (removed from the pending queue), but neither
      // connection is done -- each has only received 100 of its 2000-byte read-ahead range.
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(destroys[0]).not.toHaveBeenCalled();
      expect(destroys[1]).not.toHaveBeenCalled();

      // AND: a third read arrives near connection A (1 MiB) -- far from connection B (15 MiB) --
      // while at capacity (2/2) and with no other pending request to protect either connection.
      const thirdReadPromise = cachedFileReader.read(1 * MEBIBYTE, 100);
      await delay(5);

      // THEN: connection B (the farther one) is evicted to make room; connection A is untouched.
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(destroys[0]).not.toHaveBeenCalled();
      expect(destroys[1]).toHaveBeenCalledTimes(1);

      emitters[2]!(100);
      await expect(thirdReadPromise).resolves.toEqual(new Uint8Array(100));
    });

    it("defaults to a single connection (evicts the prior one) when maxConcurrentConnections is not specified", async () => {
      // GIVEN: the same "connection outlives its own resolved request" setup as the eviction test
      // above (via a small readAheadBufferBytes extension), but without opting into
      // multi-connection -- reproduces the original single-connection semantics exactly.
      const emitters: Array<(bytes: number) => void> = [];
      const destroys: jest.Mock[] = [];
      const fetch = jest.fn((): FileStream => {
        let dataCallback: ((chunk: Uint8Array) => void) | undefined;
        const destroy = jest.fn();
        destroys.push(destroy);
        emitters.push((bytes: number) => dataCallback?.(new Uint8Array(bytes)));
        return {
          on: (
            type: "data" | "error" | "end",
            callback: ((_: Uint8Array) => void) & ((_: Error) => void) & (() => void),
          ) => {
            if (type === "data") {
              dataCallback = callback;
            }
          },
          destroy,
        };
      });
      const fileReader: FileReader = { open: async () => ({ size: 20 * MEBIBYTE }), fetch };
      const cachedFileReader = new CachedFilelike({
        fileReader,
        cacheSizeInBytes: 4 * MEBIBYTE,
        readAheadBufferBytes: 2000,
        log,
      });

      // WHEN: the first request resolves, but its connection is still extending via read-ahead...
      const firstReadPromise = cachedFileReader.read(0, 100);
      await delay(5);
      emitters[0]!(100);
      await expect(firstReadPromise).resolves.toEqual(new Uint8Array(100));
      expect(destroys[0]).not.toHaveBeenCalled();

      // ...and then a disjoint (seek-like) read arrives.
      const secondReadPromise = cachedFileReader.read(10 * MEBIBYTE, 100);
      await delay(5);

      // THEN: the original single-connection behavior is preserved -- the still-extending first
      // connection is torn down to make room for the new one, even though nothing protects it
      // (there's no other pending request, matching the original always-replace semantics).
      expect(destroys[0]).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledTimes(2);

      emitters[1]!(100);
      await expect(secondReadPromise).resolves.toEqual(new Uint8Array(100));
    });

    it("destroys every active connection on close() when more than one is open", async () => {
      // GIVEN: 2 concurrent, never-resolving connections.
      const fetchMock = jest.fn((): FileStream => ({ on: () => {}, destroy: jest.fn() }));
      const fileReader: FileReader = {
        open: async () => ({ size: 20 * MEBIBYTE }),
        fetch: fetchMock,
      };
      const cachedFileReader = new CachedFilelike({
        fileReader,
        cacheSizeInBytes: 4 * MEBIBYTE,
        readAheadEnabled: false,
        maxConcurrentConnections: 2,
        log,
      });

      cachedFileReader.read(0, 1024).catch(() => {});
      await delay(5);
      cachedFileReader.read(10 * MEBIBYTE, 1024).catch(() => {});
      await delay(5);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // WHEN: the reader is closed.
      cachedFileReader.close();

      // THEN: both underlying streams are destroyed, not just the most recent one.
      const firstStream = fetchMock.mock.results[0]!.value;
      const secondStream = fetchMock.mock.results[1]!.value;
      expect(firstStream.destroy).toHaveBeenCalledTimes(1);
      expect(secondStream.destroy).toHaveBeenCalledTimes(1);
    });
  });
});
