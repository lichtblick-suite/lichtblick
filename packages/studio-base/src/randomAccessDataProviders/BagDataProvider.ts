// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { debounce, isEqual } from "lodash";
import decompressLZ4 from "wasm-lz4";

import Logger from "@foxglove/log";
import { Bag } from "@foxglove/rosbag";
import { BlobReader } from "@foxglove/rosbag/web";
import { Time, add, compare, fromMillis, subtract as subtractTimes } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import BrowserHttpReader from "@foxglove/studio-base/randomAccessDataProviders/BrowserHttpReader";
import {
  RandomAccessDataProvider,
  RandomAccessDataProviderDescriptor,
  Connection,
  ExtensionPoint,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
  AverageThroughput,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import { getReportMetadataForChunk } from "@foxglove/studio-base/randomAccessDataProviders/util";
import CachedFilelike, { FileReader } from "@foxglove/studio-base/util/CachedFilelike";
import { bagConnectionsToTopics } from "@foxglove/studio-base/util/bagConnectionsHelper";
import { getBagChunksOverlapCount } from "@foxglove/studio-base/util/bags";
import { UserError } from "@foxglove/studio-base/util/errors";
import sendNotification from "@foxglove/studio-base/util/sendNotification";
import Bzip2 from "@foxglove/wasm-bz2";

type BagPath = { type: "file"; file: Blob } | { type: "remoteBagUrl"; url: string };

type Options = { bagPath: BagPath; cacheSizeInBytes?: number };

const log = Logger.getLogger(__filename);

type ReadResult = Parameters<Parameters<Bag["readMessages"]>[1]>[0];

function reportMalformedError(operation: string, error: Error): void {
  sendNotification(
    `Error during ${operation}`,
    `An error was encountered during ${operation}. This usually happens if the bag is somehow malformed.\n\n${error.stack}`,
    "user",
    "error",
  );
}

export type TimedDataThroughput = {
  startTime: Time;
  endTime: Time;
  data: AverageThroughput;
};

export const statsAreAdjacent = (a: TimedDataThroughput, b: TimedDataThroughput): boolean => {
  return (
    isEqual(a.data.topics, b.data.topics) &&
    isEqual(add(a.endTime, { sec: 0, nsec: 1 }), b.startTime)
  );
};

const mergeStats = (a: TimedDataThroughput, b: TimedDataThroughput): TimedDataThroughput => ({
  startTime: a.startTime,
  endTime: b.endTime,
  data: {
    // Don't spread here, we need to update this function if we add fields.
    topics: a.data.topics,
    type: a.data.type,
    totalSizeOfMessages: a.data.totalSizeOfMessages + b.data.totalSizeOfMessages,
    numberOfMessages: a.data.numberOfMessages + b.data.numberOfMessages,
    receivedRangeDuration: add(a.data.receivedRangeDuration, b.data.receivedRangeDuration),
    requestedRangeDuration: add(a.data.requestedRangeDuration, b.data.requestedRangeDuration),
    totalTransferTime: add(a.data.totalTransferTime, b.data.totalTransferTime),
  },
});

// A FileReader that "spies" on data callbacks. Used to log data consumed.
class LogMetricsReader {
  private _reader: FileReader;
  private _extensionPoint: ExtensionPoint;
  constructor(reader: FileReader, extensionPoint: ExtensionPoint) {
    this._reader = reader;
    this._extensionPoint = extensionPoint;
  }
  async open() {
    return await this._reader.open();
  }
  fetch(offset: number, length: number) {
    const stream = this._reader.fetch(offset, length);
    stream.on("data", getReportMetadataForChunk(this._extensionPoint));
    return stream;
  }
}

// Read from a ROS Bag. `bagPath` can either represent a local file, or a remote bag. See
// `BrowserHttpReader` for how to set up a remote server to be able to directly stream from it.
// Returns raw messages that still need to be parsed by `ParseMessagesDataProvider`.
export default class BagDataProvider implements RandomAccessDataProvider {
  private _options: Options;
  private _bag?: Bag;
  private _lastPerformanceStatsToLog?: TimedDataThroughput;
  private _extensionPoint?: ExtensionPoint;
  private bzip2?: Bzip2;

  constructor(options: Options, children: RandomAccessDataProviderDescriptor[]) {
    if (children.length > 0) {
      throw new Error("BagDataProvider cannot have children");
    }
    this._options = options;
  }

  async initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    this._extensionPoint = extensionPoint;
    const { bagPath, cacheSizeInBytes } = this._options;
    await decompressLZ4.isLoaded;
    this.bzip2 = await Bzip2.init();

    try {
      if (bagPath.type === "remoteBagUrl") {
        const fileReader = new LogMetricsReader(new BrowserHttpReader(bagPath.url), extensionPoint);
        const remoteReader = new CachedFilelike({
          fileReader,
          cacheSizeInBytes: cacheSizeInBytes ?? 1024 * 1024 * 200, // 200MiB
          logFn: (message) => {
            log.info(`CachedFilelike: ${message}`);
          },
          // eslint-disable-next-line @foxglove/no-boolean-parameters
          keepReconnectingCallback: (reconnecting: boolean) => {
            extensionPoint.reportMetadataCallback({
              type: "updateReconnecting",
              reconnecting,
            });
          },
        });
        try {
          await remoteReader.open(); // Important that we call this first, because it might throw an error if the file can't be read.
        } catch (err) {
          sendNotification("Fetching remote bag failed", (err as Error).message, "user", "error");
          return await new Promise(() => {}); // Just never finish initializing.
        }
        if (remoteReader.size() === 0) {
          sendNotification("Cannot play invalid bag", "Bag is 0 bytes in size.", "user", "error");
          return await new Promise(() => {}); // Just never finish initializing.
        }

        this._bag = new Bag(remoteReader);

        try {
          await this._bag.open();
        } catch (err) {
          sendNotification("Opening remote bag failed", (err as Error).message, "user", "error");
          return await new Promise(() => {}); // Just never finish initializing.
        }
      } else {
        this._bag = new Bag(new BlobReader(bagPath.file));
        await this._bag.open();
      }
    } catch (err) {
      // Errors in this section come from invalid user data, so we don't want them to be reported as
      // crashes.
      throw new UserError(err);
    }

    const { startTime, endTime, chunkInfos } = this._bag;
    const connections: Connection[] = [];
    const emptyConnections: {
      // eslint-disable-next-line no-restricted-syntax
      [K in keyof Connection]?: Connection[K] | null;
    }[] = [];
    for (const [connId, connection] of this._bag.connections) {
      const { messageDefinition, md5sum, topic, type, callerid } = connection;
      if (md5sum && topic && type) {
        connections.push({
          messageDefinition,
          md5sum,
          topic,
          type,
          callerid: callerid ?? String(connId),
        });
      } else {
        emptyConnections.push(connection);
      }
    }
    if (emptyConnections.length > 0) {
      sendNotification(
        "Empty connections found",
        `This bag has some empty connections, which Foxglove Studio does not currently support. We'll try to play the remaining topics. Details:\n\n${JSON.stringify(
          emptyConnections,
        )}`,
        "user",
        "warn",
      );
    }

    if (!startTime || !endTime || connections.length === 0) {
      // This will abort video generation:
      sendNotification("Cannot play invalid bag", "Bag is empty or corrupt.", "user", "error");
      return await new Promise(() => {
        // no-op
      }); // Just never finish initializing.
    }
    const chunksOverlapCount = getBagChunksOverlapCount(chunkInfos);
    // If >25% of the chunks overlap, show a warning. It's common for a small number of chunks to overlap
    // since it looks like `rosbag record` has a bit of a race condition, and that's not too terrible, so
    // only warn when there's a more serious slowdown.
    if (chunksOverlapCount > chunkInfos.length * 0.25) {
      sendNotification(
        "Bag is unsorted, which is slow",
        `This bag has many overlapping chunks (${chunksOverlapCount} out of ${chunkInfos.length}), which means that we have to decompress many chunks in order to load a particular time range. This is slow. Ideally, fix this where you're generating your bags, by sorting the messages by receive time, e.g. using a script like this: https://gist.github.com/janpaul123/deaa92338d5e8309ef7aa7a55d625152`,
        "user",
        "warn",
      );
    }

    const messageDefinitionsByTopic: Record<string, string> = {};
    for (const connection of connections) {
      messageDefinitionsByTopic[connection.topic] = connection.messageDefinition;
    }

    return {
      start: startTime,
      end: endTime,
      topics: bagConnectionsToTopics(connections, chunkInfos),
      connections,
      messageDefinitions: {
        type: "raw",
        messageDefinitionsByTopic,
      },
      providesParsedMessages: false,
      problems: [],
    };
  }

  private _logStats = (): void => {
    if (this._extensionPoint == undefined || this._lastPerformanceStatsToLog == undefined) {
      return;
    }
    this._extensionPoint.reportMetadataCallback(this._lastPerformanceStatsToLog.data);
    this._lastPerformanceStatsToLog = undefined;
  };

  // Logs some stats if it has been more than a second since the last call.
  private _debouncedLogStats = debounce(this._logStats, 1000, { leading: false, trailing: true });

  private _queueStats(stats: TimedDataThroughput): void {
    if (
      this._lastPerformanceStatsToLog != undefined &&
      statsAreAdjacent(this._lastPerformanceStatsToLog, stats)
    ) {
      // The common case: The next bit of data will be next to the last one. For remote bags we'll
      // reuse the connection.
      this._lastPerformanceStatsToLog = mergeStats(this._lastPerformanceStatsToLog, stats);
    } else {
      // For the initial load, or after a seek, a fresh connectionwill be made for remote bags.
      // Eagerly log any stats we know are "done".
      this._logStats();
      this._lastPerformanceStatsToLog = stats;
    }
    // Kick the can down the road whether it's new or existing.
    this._debouncedLogStats();
  }

  async getMessages(
    start: Time,
    end: Time,
    subscriptions: GetMessagesTopics,
  ): Promise<GetMessagesResult> {
    const topics = subscriptions.rosBinaryMessages ?? [];
    const connectionStart = fromMillis(new Date().getTime());
    let totalSizeOfMessages = 0;
    let numberOfMessages = 0;
    const messages: MessageEvent<ArrayBuffer>[] = [];
    const onMessage = (msg: ReadResult) => {
      const { data, topic, timestamp } = msg;
      messages.push({
        topic,
        receiveTime: timestamp,
        message: data.buffer.slice(data.byteOffset, data.byteOffset + data.length),
      });
      totalSizeOfMessages += data.length;
      numberOfMessages += 1;
    };
    const options = {
      topics: topics.slice(), // copy because `topics` not readonly in rosbag
      startTime: start,
      endTime: end,
      noParse: true,
      decompress: {
        bz2: (buffer: Uint8Array, size: number) => {
          if (!this.bzip2) {
            throw new Error("bzip2 not initialized");
          }
          try {
            return this.bzip2.decompress(buffer, size, { small: false });
          } catch (error) {
            reportMalformedError("bz2 decompression", error);
            throw error;
          }
        },
        lz4: (buffer: Uint8Array, size: number) => {
          try {
            return decompressLZ4(buffer, size);
          } catch (error) {
            reportMalformedError("lz4 decompression", error);
            throw error;
          }
        },
      },
    };
    try {
      await this._bag?.readMessages(options, onMessage);
    } catch (error) {
      reportMalformedError("bag parsing", error);
      throw error;
    }
    messages.sort((a, b) => compare(a.receiveTime, b.receiveTime));
    // Range end is inclusive.
    const duration = add(subtractTimes(end, start), { sec: 0, nsec: 1 });
    this._queueStats({
      startTime: start,
      endTime: end,
      data: {
        type: "average_throughput",
        totalSizeOfMessages,
        numberOfMessages,
        // Note: Requested durations are wrong by a nanosecond -- ranges are inclusive.
        requestedRangeDuration: duration,
        receivedRangeDuration: duration,
        topics,
        totalTransferTime: subtractTimes(fromMillis(new Date().getTime()), connectionStart),
      },
    });
    return { rosBinaryMessages: messages, parsedMessages: undefined };
  }

  async close(): Promise<void> {
    // no-op
  }
}
