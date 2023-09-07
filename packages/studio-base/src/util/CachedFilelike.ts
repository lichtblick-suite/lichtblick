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
import * as _ from "lodash-es";

import Logger from "@foxglove/log";
import { Filelike } from "@foxglove/rosbag";

import VirtualLRUBuffer from "./VirtualLRUBuffer";
import { getNewConnection } from "./getNewConnection";
import { Range } from "./ranges";

// CachedFilelike is a `Filelike` that attempts to do as much caching of the file in memory as
// possible. It takes in 3 named arguments to its constructor:
// - fileReader: a `FileReader` instance (defined below). This essentially does the streamed
//     fetching of ranges from our file.
// - cacheSizeInBytes (optional): how many bytes we're allowed to cache. Defaults to infinite
//     caching (meaning that the cache will be as big as the file size). `cacheSizeInBytes` also
//     becomes the largest range of data that can be requested.
// - logFn (optional): a log function. Useful for logging in a particular format. Defaults to
//     `console.log`.
// - keepReconnectingCallback (optional): if set, we assume that we want to keep retrying on connection
//     error, in which case the callback gets called with an update on whether we are currently
//     reconnecting. This is useful when the connection is expected to be spotty, e.g. when
//     running this code in a browser instead of on a server. If omitted, we will retry for a short
//     amount of time and then reject read requests.
//
// Under the hood this uses a `VirtualLRUBuffer`, which represents the entire file in memory, even
// though only parts of it may actually be stored in memory. It also manages evicting least recently
// used blocks from memory.
//
// We keep a list of byte ranges that have been requested, and their associated callbacks. Typically
// there will be only one such requested range at the time, as usually we need to parse some data
// first before we can read more. We keep one stream from the `fileReader` open at a time, and we
// serve the requested byte ranges in order.
//
// If there are currently no requested byte ranges, we try to intelligently load as much data as
// possible into memory, with a preference given to ranges immediately following the last requested
// byte range. If the cache spans the entire file size, we try to download the entire file.

export type FileStream = {
  on<T>(event: "data", listener: (chunk: T) => void): void;
  on(event: "error", listener: (err: Error) => void): void;
  destroy: () => void;
};
export interface FileReader {
  open(): Promise<{ size: number }>;
  fetch(offset: number, length: number): FileStream;
}

const LOGGING_INTERVAL_IN_BYTES = 1024 * 1024 * 100; // Log every 100MiB to avoid cluttering the logs too much.
const CACHE_BLOCK_SIZE = 1024 * 1024 * 10; // 10MiB blocks.
// Don't start a new connection if we're 5MiB away from downloading the requested byte.
const CLOSE_ENOUGH_BYTES_TO_NOT_START_NEW_CONNECTION = 1024 * 1024 * 5;

const log = Logger.getLogger(__filename);

interface ILogger {
  debug(..._args: unknown[]): void;
  info(..._args: unknown[]): void;
  warn(..._args: unknown[]): void;
  error(..._args: unknown[]): void;
}

export default class CachedFilelike implements Filelike {
  #fileReader: FileReader;
  #cacheSizeInBytes: number = Infinity;
  #fileSize?: number;
  #virtualBuffer: VirtualLRUBuffer;
  #log: ILogger;
  #closed: boolean = false;
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  #keepReconnectingCallback?: (reconnecting: boolean) => void;

  // The current active connection, if there is one. `remainingRange.start` gets updated whenever
  // we receive new data, so it truly is the remaining range that it is going to download.
  #currentConnection: { stream: FileStream; remainingRange: Range } | undefined;

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
    log?: ILogger;
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    keepReconnectingCallback?: (reconnecting: boolean) => void;
  }) {
    this.#fileReader = options.fileReader;
    this.#cacheSizeInBytes = options.cacheSizeInBytes ?? this.#cacheSizeInBytes;
    this.#keepReconnectingCallback = options.keepReconnectingCallback;
    this.#log = options.log ?? log;
    this.#virtualBuffer = new VirtualLRUBuffer({ size: 0 });
  }

  public async open(): Promise<void> {
    if (this.#fileSize != undefined) {
      return;
    }
    const { size } = await this.#fileReader.open();
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
    this.#log.info(`Opening file with size ${bytesToMiB(this.#fileSize)}MiB`);
  }

  // Get the file size. Requires a call to `open()` or `read()` first.
  public size(): number {
    if (this.#fileSize == undefined) {
      throw new Error("CachedFilelike has not been opened");
    }
    return this.#fileSize;
  }

  // Potentially performance-sensitive; await can be expensive
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  public read(offset: number, length: number): Promise<Uint8Array> {
    if (length === 0) {
      return Promise.resolve(new Uint8Array());
    }

    const range = { start: offset, end: offset + length };

    if (offset < 0 || length < 0) {
      throw new Error("CachedFilelike#read invalid input");
    }
    if (length > this.#cacheSizeInBytes) {
      throw new Error(`Requested more data than cache size: ${length} > ${this.#cacheSizeInBytes}`);
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
        .catch((err) => {
          reject(err);
        });
    });
  }

  // Gets called any time our connection or read requests change.
  #updateState(): void {
    if (this.#closed) {
      return;
    }

    // First, see if there are any read requests that we can resolve now.
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

    // Then see if we need to set a new connection based on the new connection and read requests state.
    const newConnection = getNewConnection({
      currentRemainingRange: this.#currentConnection
        ? this.#currentConnection.remainingRange
        : undefined,
      readRequestRange: this.#readRequests[0] ? this.#readRequests[0].range : undefined,
      downloadedRanges: this.#virtualBuffer.getRangesWithData(),
      lastResolvedCallbackEnd: this.#lastResolvedCallbackEnd,
      maxRequestSize: this.#cacheSizeInBytes,
      fileSize: size,
      continueDownloadingThreshold: CLOSE_ENOUGH_BYTES_TO_NOT_START_NEW_CONNECTION,
    });
    if (newConnection) {
      this.#setConnection(newConnection);
    }
  }

  // Replace the current connection with a new one, spanning a certain range.
  #setConnection(range: Range): void {
    this.#log.debug(`Setting new connection @ ${rangeToString(range)}`);

    if (this.#currentConnection) {
      // Destroy the current connection if there is one.
      const currentConnection = this.#currentConnection;
      currentConnection.stream.destroy();
      this.#log.debug(
        `Destroyed current connection @ ${rangeToString(currentConnection.remainingRange)}`,
      );
    }

    // Start the stream, and update the current connection state.
    const stream = this.#fileReader.fetch(range.start, range.end - range.start);
    this.#currentConnection = { stream, remainingRange: range };

    stream.on("error", (error: Error) => {
      const currentConnection = this.#currentConnection;
      if (!currentConnection || stream !== currentConnection.stream) {
        return; // Ignore errors from old streams.
      }

      if (this.#keepReconnectingCallback) {
        // If this callback is set, just keep retrying.
        if (this.#lastErrorTime == undefined) {
          // And if this is the first error, let the callback know.
          this.#keepReconnectingCallback(true);
        }
      } else {
        // Otherwise, if we get two errors in a short timespan (100ms) then there is probably a
        // serious error, we resolve all remaining callbacks with errors and close out.
        const lastErrorTime = this.#lastErrorTime;
        if (lastErrorTime != undefined && Date.now() - lastErrorTime < 100) {
          this.#log.error(
            `Connection @ ${rangeToString(
              range,
            )} threw another error; closing: ${error.toString()}`,
          );

          this.#closed = true;
          for (const request of this.#readRequests) {
            request.reject(error);
          }
          return;
        }
      }

      // When we encounter an error there is usually a bad connection or timeout or so, so just
      // mark the current connection as destroyed, and try again.
      this.#log.info(
        `Connection @ ${rangeToString(range)} threw error; trying to continue: ${error.toString()}`,
      );
      this.#lastErrorTime = Date.now();
      currentConnection.stream.destroy();
      this.#currentConnection = undefined;
      this.#updateState();
    });

    // Handle the data stream.
    const startTime = Date.now();
    let bytesRead = 0;
    let lastReportedBytesRead = 0;
    stream.on("data", (chunk: Uint8Array) => {
      const currentConnection = this.#currentConnection;
      if (!currentConnection || stream !== currentConnection.stream) {
        return; // Ignore data from old streams.
      }

      if (this.#lastErrorTime != undefined) {
        // If we had an error before, then that has clearly been resolved since we received some data.
        this.#lastErrorTime = undefined;
        if (this.#keepReconnectingCallback) {
          // And if we had a callback, let it know that the issue has been resolved.
          this.#keepReconnectingCallback(false);
        }
      }

      // Copy the data into the VirtualLRUBuffer.
      this.#virtualBuffer.copyFrom(chunk, currentConnection.remainingRange.start);
      bytesRead += chunk.byteLength;

      // Every now and then, do some logging of the current download speed.
      if (bytesRead - lastReportedBytesRead > LOGGING_INTERVAL_IN_BYTES) {
        lastReportedBytesRead = bytesRead;
        const sec = (Date.now() - startTime) / 1000;

        const mibibytes = bytesToMiB(bytesRead);
        const speed = _.round(mibibytes / sec, 2);
        this.#log.debug(
          `Connection @ ${rangeToString(
            currentConnection.remainingRange,
          )} downloading at ${speed} MiB/s`,
        );
      }

      if (this.#virtualBuffer.hasData(range.start, range.end)) {
        // If the requested range has been downloaded, we're done!
        this.#log.info(`Connection @ ${rangeToString(currentConnection.remainingRange)} finished!`);
        stream.destroy();
        this.#currentConnection = undefined;
      } else {
        // Otherwise, update `remainingRange`.
        this.#currentConnection = {
          stream,
          remainingRange: { start: range.start + bytesRead, end: range.end },
        };
      }

      // Always call `_updateState` so it can decide to create new connections, resolve callbacks, etc.
      this.#updateState();
    });
  }
}

// Some formatting functions.
function bytesToMiB(bytes: number) {
  return _.round(bytes / 1024 / 1024, 3);
}
function rangeToString(range: Range) {
  return `${bytesToMiB(range.start)}-${bytesToMiB(range.end)}MiB`;
}
