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
import { isOverlapping } from "intervals-fn";
import * as _ from "lodash-es";

import Logger from "@lichtblick/log";
import { Filelike } from "@lichtblick/rosbag";

import type { FileReader, FileStream, ILogger } from "./CachedFilelike.types";
import VirtualLRUBuffer from "./VirtualLRUBuffer";
import { getNewConnection } from "./getNewConnection";
import { Range } from "./ranges";

// CachedFilelike is a streamed Filelike backed by a VirtualLRUBuffer.
// It serves requested byte ranges from an in-memory LRU cache, keeps at most
// `maxConcurrentConnections` underlying fetches active, and optionally uses bounded
// read-ahead/reconnect behavior for remote readers.

const LOGGING_INTERVAL_IN_BYTES = 1024 * 1024 * 300; // Log every 300MiB to avoid cluttering the logs too much.
const CACHE_BLOCK_SIZE = 1024 * 1024 * 10; // 10MiB blocks.
// Don't start a new connection if we're 5MiB away from downloading the requested byte.
const CLOSE_ENOUGH_BYTES_TO_NOT_START_NEW_CONNECTION = 1024 * 1024 * 5;
// Multi-file remote sessions opt into 2 (see MultiIterableSource).
const DEFAULT_MAX_CONCURRENT_CONNECTIONS = 1;

const log = Logger.getLogger(__filename);

export default class CachedFilelike implements Filelike {
  #fileReader: FileReader;
  #cacheSizeInBytes: number = Infinity;
  readonly #readAheadEnabled: boolean = true;
  #readAheadBufferBytes: number | undefined;
  #idleReadAheadPaused = false;
  readonly #maxConcurrentConnections: number;
  #fileSize?: number;
  #virtualBuffer: VirtualLRUBuffer;
  #log: ILogger;
  #closed: boolean = false;
  // In-flight uncached reads, tracked so close() can destroy streams and reject promises.
  readonly #activeUncachedReads = new Set<{ cancel: (err: Error) => void }>();
  // eslint-disable-next-line @lichtblick/no-boolean-parameters
  #keepReconnectingCallback?: (reconnecting: boolean) => void;

  // Active connections, oldest first. `remainingRange.start` advances as data arrives.
  #connections: { stream: FileStream; remainingRange: Range }[] = [];

  // A list of read requests and associated ranges for all read requests, in order.
  #readRequests: {
    range: Range;
    resolve: (_: Uint8Array) => void;
    reject: (_: Error) => void;
    requestTime: number;
  }[] = [];

  // The range.end of the last read request that we resolved. Useful for reading ahead a bit.
  #lastResolvedCallbackEnd?: number;

  // The last time we've encountered an error;
  #lastErrorTime?: number;

  public constructor(options: {
    fileReader: FileReader;
    cacheSizeInBytes?: number;
    readAheadEnabled?: boolean;
    readAheadBufferBytes?: number;
    maxConcurrentConnections?: number;
    log?: ILogger;
    // eslint-disable-next-line @lichtblick/no-boolean-parameters
    keepReconnectingCallback?: (reconnecting: boolean) => void;
  }) {
    this.#fileReader = options.fileReader;
    this.#cacheSizeInBytes = options.cacheSizeInBytes ?? this.#cacheSizeInBytes;
    this.#readAheadEnabled = options.readAheadEnabled ?? this.#readAheadEnabled;
    this.#readAheadBufferBytes = options.readAheadBufferBytes;
    this.#maxConcurrentConnections =
      options.maxConcurrentConnections ?? DEFAULT_MAX_CONCURRENT_CONNECTIONS;
    this.#keepReconnectingCallback = options.keepReconnectingCallback;
    this.#log = options.log ?? log;
    this.#virtualBuffer = new VirtualLRUBuffer({ size: 0 });
  }

  public async open(): Promise<void> {
    if (this.#fileSize != undefined) {
      return;
    }
    const { size, prefetched } = await this.#fileReader.open();
    this.#fileSize = size;
    if (this.#cacheSizeInBytes >= size) {
      // If we have a cache limit that exceeds the file size, then we don't need to limit ourselves
      // to small blocks. This way `VirtualLRUBuffer#slice` will be faster since we'll almost always
      // not need to copy from multiple blocks into a new `Buffer` instance.
      this.#virtualBuffer = new VirtualLRUBuffer({ size });
    } else {
      this.#virtualBuffer = new VirtualLRUBuffer({
        size,
        blockSize: CACHE_BLOCK_SIZE,
        // Rather create too many blocks than too few (Math.ceil), and always add one block,
        // to allow for a read range not starting or ending perfectly at a block boundary.
        numberOfBlocks: Math.ceil(this.#cacheSizeInBytes / CACHE_BLOCK_SIZE) + 2,
      });
    }
    for (const { offset, data } of prefetched ?? []) {
      const fitsFile = offset >= 0 && data.byteLength > 0 && offset + data.byteLength <= size;
      if (fitsFile && data.byteLength <= this.#cacheSizeInBytes) {
        this.#virtualBuffer.copyFrom(Buffer.from(data), offset);
      }
    }
    this.#log.info(`Opening file with size ${bytesToMiB(this.#fileSize)}MiB`);
  }

  // Get the file size. Requires a call to `open()` or `read()` first.
  public size(): number {
    if (this.#fileSize == undefined) {
      throw new Error("CachedFilelike has not been opened");
    }
    return this.#fileSize;
  }

  // Applies to connections opened from now on; undefined restores getNewConnection's default.
  public setReadAheadBufferBytes(bytes: number | undefined): void {
    this.#readAheadBufferBytes = bytes;
  }

  // While paused, no speculative download starts when there are no pending reads.
  public pauseIdleReadAhead(): void {
    this.#idleReadAheadPaused = true;
  }

  public resumeIdleReadAhead(): void {
    this.#idleReadAheadPaused = false;
  }

  // Potentially performance-sensitive; await can be expensive
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  public read(offset: number, length: number): Promise<Uint8Array> {
    if (this.#closed) {
      return Promise.reject(new Error("CachedFilelike is closed"));
    }
    if (length === 0) {
      return Promise.resolve(new Uint8Array());
    }

    const range = { start: offset, end: offset + length };

    if (offset < 0 || length < 0) {
      throw new Error("CachedFilelike#read invalid input");
    }
    if (length > this.#cacheSizeInBytes) {
      // A single read larger than the LRU cache budget (e.g. an MCAP summary/index section that
      // exceeds a small per-source cache slice in a many-file remote session) cannot be served
      // through the VirtualLRUBuffer. Rather than failing, fetch the exact range directly without
      // caching. Memory stays transient and the cache budget is unchanged.
      return this.#readUncached(range);
    }

    // Potentially performance-sensitive; await can be expensive
    return new Promise((resolve, reject) => {
      this.open()
        .then(() => {
          const size = this.size();
          if (range.end > size) {
            reject(new Error(`CachedFilelike#read past size`));
            return;
          }

          this.#readRequests.push({ range, resolve, reject, requestTime: Date.now() });
          this.#updateState();
        })
        .catch((err: unknown) => {
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
  }

  // Terminal close: abort downloads, reject pending reads, and release cache blocks promptly.
  public close(): void {
    this.#closeWithError(new Error("CachedFilelike is closed"));
  }

  // Shared terminal-close path for close() and fatal connection errors. Iterating
  // #activeUncachedReads is safe because cancel() is synchronous and only removes the current Set
  // entry.
  #closeWithError(error: Error): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    for (const connection of this.#connections) {
      connection.stream.destroy();
    }
    this.#connections = [];
    for (const request of this.#readRequests) {
      request.reject(error);
    }
    this.#readRequests = [];
    for (const active of this.#activeUncachedReads) {
      active.cancel(error);
    }
    this.#virtualBuffer = new VirtualLRUBuffer({ size: 0 });
  }

  // Reads a byte range directly from the underlying file reader without caching. Used for single
  // reads larger than the LRU cache budget, which cannot be represented in the VirtualLRUBuffer.
  async #readUncached(range: Range): Promise<Uint8Array> {
    await this.open();
    if (this.#closed) {
      throw new Error("CachedFilelike is closed");
    }
    if (range.end > this.size()) {
      throw new Error(`CachedFilelike#read past size`);
    }

    const length = range.end - range.start;
    return await new Promise<Uint8Array>((resolve, reject) => {
      const result = new Uint8Array(length);
      let bytesRead = 0;
      let settled = false;
      const stream = this.#fileReader.fetch(range.start, length);

      // Registered so close() can destroy the stream and reject this read.
      const active: { cancel: (err: Error) => void } = { cancel: () => {} };
      const finish = (action: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        this.#activeUncachedReads.delete(active);
        stream.destroy();
        action();
      };
      active.cancel = (err: Error) => {
        finish(() => {
          reject(err);
        });
      };
      this.#activeUncachedReads.add(active);

      stream.on("error", (error: Error) => {
        finish(() => {
          reject(error);
        });
      });

      // A stream that ends before `length` bytes were received must reject, not hang forever.
      stream.on("end", () => {
        finish(() => {
          reject(
            new Error(
              `CachedFilelike#readUncached stream ended after ${bytesRead}/${length} bytes`,
            ),
          );
        });
      });

      stream.on("data", (chunk: Uint8Array) => {
        if (settled) {
          return;
        }
        if (bytesRead + chunk.byteLength > length) {
          finish(() => {
            reject(new Error("CachedFilelike#readUncached received more data than requested"));
          });
          return;
        }
        result.set(chunk, bytesRead);
        bytesRead += chunk.byteLength;
        if (bytesRead === length) {
          finish(() => {
            resolve(result);
          });
        }
      });
    });
  }

  // Gets called any time our connection or read requests change.
  #updateState(): void {
    if (this.#closed) {
      return;
    }

    this.#readRequests = this.#readRequests.filter(({ range, resolve }) => {
      if (!this.#virtualBuffer.hasData(range.start, range.end)) {
        return true;
      }

      this.#lastResolvedCallbackEnd = range.end;
      const buffer = this.#virtualBuffer.slice(range.start, range.end);

      resolve(buffer);
      return false;
    });

    const size = this.size();
    const commonOptions = {
      downloadedRanges: this.#virtualBuffer.getRangesWithData(),
      lastResolvedCallbackEnd: this.#lastResolvedCallbackEnd,
      maxRequestSize: this.#cacheSizeInBytes,
      fileSize: size,
      continueDownloadingThreshold: CLOSE_ENOUGH_BYTES_TO_NOT_START_NEW_CONNECTION,
      readAheadEnabled: this.#readAheadEnabled,
      readAheadBufferBytes: this.#readAheadBufferBytes,
    };

    if (this.#readRequests.length === 0) {
      // Only read ahead speculatively when no connection is open.
      if (this.#connections.length === 0 && !this.#idleReadAheadPaused) {
        const newConnection = getNewConnection({
          currentRemainingRange: undefined,
          readRequestRange: undefined,
          ...commonOptions,
        });
        if (newConnection) {
          this.#setConnection(newConnection);
        }
      }
      return;
    }

    // Oldest request has priority; later requests may not evict connections serving earlier ones.
    for (const [index, request] of this.#readRequests.entries()) {
      const newConnection = getNewConnection({
        currentRemainingRange: this.#connections[0]?.remainingRange,
        additionalRemainingRanges: this.#connections.slice(1).map((c) => c.remainingRange),
        readRequestRange: request.range,
        ...commonOptions,
      });
      if (!newConnection) {
        continue;
      }
      if (this.#connections.length < this.#maxConcurrentConnections) {
        this.#setConnection(newConnection);
        continue;
      }
      const higherPriorityRanges = this.#readRequests.slice(0, index).map((r) => r.range);
      this.#setConnection(newConnection, { protectedRanges: higherPriorityRanges });
    }
  }

  // Open a connection for `range`, evicting one first when at capacity. Connections overlapping
  // `protectedRanges` are never evicted; if all are protected, this is a no-op.
  #setConnection(range: Range, options?: { protectedRanges?: Range[] }): void {
    if (range.end <= range.start) {
      // Prevent an invalid/inverted HTTP Range header (for example "bytes=100-99") and the 416
      // response it would trigger; keep this defense-in-depth even though getNewConnection guards it.
      this.#log.debug(`Ignoring degenerate zero-width connection range @ ${rangeToString(range)}`);
      return;
    }

    this.#log.debug(`Setting new connection @ ${rangeToString(range)}`);

    if (this.#connections.length >= this.#maxConcurrentConnections) {
      const protectedRanges = options?.protectedRanges ?? [];
      const evictableIndexes = this.#connections
        .map((_connection, i) => i)
        .filter(
          (i) =>
            !protectedRanges.some((protectedRange) =>
              isOverlapping([this.#connections[i]!.remainingRange], [protectedRange]),
            ),
        );
      if (evictableIndexes.length === 0) {
        return;
      }

      // Evict the connection farthest from the new range.
      let evictIndex = evictableIndexes[0]!;
      let maxDistance = -1;
      for (const i of evictableIndexes) {
        const distance = Math.abs(this.#connections[i]!.remainingRange.start - range.start);
        if (distance > maxDistance) {
          maxDistance = distance;
          evictIndex = i;
        }
      }
      const [evicted] = this.#connections.splice(evictIndex, 1);
      evicted!.stream.destroy();
      this.#log.debug(
        `Destroyed connection @ ${rangeToString(evicted!.remainingRange)} to make room for @ ${rangeToString(range)}`,
      );
    }

    const stream = this.#fileReader.fetch(range.start, range.end - range.start);
    this.#connections.push({ stream, remainingRange: range });

    stream.on("error", (error: Error) => {
      this.#handleConnectionInterrupted({
        stream,
        range,
        error,
        reason: "threw error",
      });
    });

    const startTime = Date.now();
    let bytesRead = 0;
    let lastReportedBytesRead = 0;
    stream.on("data", (chunk: Uint8Array) => {
      const index = this.#connections.findIndex((c) => c.stream === stream);
      if (index === -1) {
        return; // Ignore data from old/evicted streams.
      }
      const connection = this.#connections[index]!;

      if (this.#lastErrorTime != undefined) {
        // If we had an error before, then that has clearly been resolved since we received some data.
        this.#lastErrorTime = undefined;
        if (this.#keepReconnectingCallback) {
          // And if we had a callback, let it know that the issue has been resolved.
          this.#keepReconnectingCallback(false);
        }
      }

      this.#virtualBuffer.copyFrom(Buffer.from(chunk), connection.remainingRange.start);
      bytesRead += chunk.byteLength;

      // Every now and then, do some logging of the current download speed.
      if (bytesRead - lastReportedBytesRead > LOGGING_INTERVAL_IN_BYTES) {
        lastReportedBytesRead = bytesRead;
        const sec = (Date.now() - startTime) / 1000;

        const mibibytes = bytesToMiB(bytesRead);
        const speed = _.round(mibibytes / sec, 2);
        this.#log.debug(
          `Connection @ ${rangeToString(connection.remainingRange)} downloading at ${speed} MiB/s`,
        );
      }

      if (this.#virtualBuffer.hasData(range.start, range.end)) {
        // If the requested range has been downloaded, we're done!
        this.#log.info(`Connection @ ${rangeToString(connection.remainingRange)} finished!`);
        stream.destroy();
        this.#connections.splice(index, 1);
      } else {
        this.#connections[index] = {
          stream,
          remainingRange: { start: range.start + bytesRead, end: range.end },
        };
      }

      // Always call #updateState() so it can resolve requests and decide on the next connection.
      this.#updateState();
    });

    stream.on("end", () => {
      const index = this.#connections.findIndex((c) => c.stream === stream);
      if (index === -1) {
        return;
      }
      const connection = this.#connections[index]!;

      if (this.#virtualBuffer.hasData(range.start, range.end)) {
        this.#log.info(`Connection @ ${rangeToString(connection.remainingRange)} finished!`);
        this.#connections.splice(index, 1);
        this.#updateState();
        return;
      }

      this.#handleConnectionInterrupted({
        stream,
        range,
        error: new Error(`Connection ended before download completed @ ${rangeToString(range)}`),
        reason: "ended early",
      });
    });
  }

  #handleConnectionInterrupted({
    stream,
    range,
    error,
    reason,
  }: {
    stream: FileStream;
    range: Range;
    error: Error;
    reason: string;
  }): void {
    const index = this.#connections.findIndex((c) => c.stream === stream);
    if (index === -1) {
      return;
    }

    if (this.#keepReconnectingCallback) {
      if (this.#lastErrorTime == undefined) {
        // And if this is the first interruption, let the callback know.
        this.#keepReconnectingCallback(true);
      }
    } else {
      // Otherwise, if we get two interruptions in a short timespan (100ms) then there is
      // probably a serious error, we resolve all remaining callbacks with errors and close out.
      const lastErrorTime = this.#lastErrorTime;
      if (lastErrorTime != undefined && Date.now() - lastErrorTime < 100) {
        this.#log.error(
          `Connection @ ${rangeToString(range)} ${reason} again; closing: ${error.toString()}`,
        );

        this.#closeWithError(error);
        return;
      }
    }

    // Mark the connection interrupted and let #updateState() decide whether to retry.
    this.#log.info(
      `Connection @ ${rangeToString(range)} ${reason}; trying to continue: ${error.toString()}`,
    );
    this.#lastErrorTime = Date.now();
    const [connection] = this.#connections.splice(index, 1);
    connection!.stream.destroy();
    this.#updateState();
  }
}

function bytesToMiB(bytes: number) {
  return _.round(bytes / 1024 / 1024, 3);
}
function rangeToString(range: Range) {
  return `${bytesToMiB(range.start)}-${bytesToMiB(range.end)}MiB`;
}
