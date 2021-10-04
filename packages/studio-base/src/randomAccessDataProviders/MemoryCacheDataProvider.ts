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

import { simplify } from "intervals-fn";
import { isEqual, sum, uniq } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { filterMap } from "@foxglove/den/collection";
import { parse as parseMessageDefinition } from "@foxglove/rosmsg";
import { LazyMessageReader } from "@foxglove/rosmsg-serialization";
import {
  Time,
  add as addTimes,
  compare,
  fromNanoSec,
  subtract as subtractTimes,
  toNanoSec,
} from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import {
  RandomAccessDataProvider,
  RandomAccessDataProviderDescriptor,
  ExtensionPoint,
  GetDataProvider,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import { getNewConnection } from "@foxglove/studio-base/util/getNewConnection";
import {
  Range,
  mergeNewRangeIntoUnsortedNonOverlappingList,
  missingRanges,
} from "@foxglove/studio-base/util/ranges";
import sendNotification from "@foxglove/studio-base/util/sendNotification";

// I (JP) mostly just made these numbers up. It might be worth experimenting with different values
// for these, but it seems to work reasonably well in my tests.
export const MIN_MEM_CACHE_BLOCK_SIZE_NS = 0.1e9; // Messages are laid out in blocks with a fixed number of milliseconds.

// Preloading algorithms get too slow when there are too many blocks. For very long bags, use longer
// blocks. Adaptive block sizing is simpler than using a tree structure for immutable updates but
// less flexible, so we may want to move away from a single-level block structure in the future.
export const MAX_BLOCKS = 400;
const READ_AHEAD_NS = 3e9; // Number of nanoseconds to read ahead from the last `getMessages` call.
export const MAX_BLOCK_SIZE_BYTES = 50e6; // Number of bytes in a block before we show an error.

// Number of bytes that we aim to keep in the cache.
// Setting this to higher than 1.5GB caused the renderer process to crash on linux on certain bags.
// See: https://github.com/foxglove/studio/pull/1733
const DEFAULT_CACHE_SIZE_BYTES = 1.0e9;

// For each memory block we store the actual messages (grouped by topic), and a total byte size of
// the underlying ArrayBuffers.
export type MemoryCacheBlock = {
  readonly messagesByTopic: {
    readonly [topic: string]: MessageEvent<unknown>[];
  };
  readonly sizeInBytes: number;
};
export type BlockCache = {
  blocks: readonly (MemoryCacheBlock | undefined)[];
  startTime: Time;
};
const EMPTY_BLOCK: MemoryCacheBlock = {
  messagesByTopic: {},
  sizeInBytes: 0,
};

function getNormalizedTopics(topics: readonly string[]): string[] {
  return uniq(topics).sort();
}

// Get the blocks to keep for the current cache purge, given the most recently accessed ranges, the
// blocks byte sizes, the minimum number of blocks to always keep, and the maximum cache size.
//
// Exported for tests.
export function getBlocksToKeep({
  recentBlockRanges,
  blockSizesInBytes,
  maxCacheSizeInBytes,
  badEvictionRange,
}: {
  // The most recently requested block ranges, ordered from most recent to least recent.
  recentBlockRanges: Range[];
  // For each block, its size, if it exists. Note that it's allowed for a `recentBlockRange` to
  // not have all blocks actually available (i.e. a seek happened before the whole range was
  // downloaded).
  blockSizesInBytes: (number | undefined)[];
  // The maximum cache size in bytes.
  maxCacheSizeInBytes: number;
  // A block index to avoid evicting blocks from near.
  badEvictionRange?: Range;
}): {
  blockIndexesToKeep: Set<number>;
  newRecentRanges: Range[];
} {
  let cacheSizeInBytes = 0;
  const blockIndexesToKeep = new Set<number>();

  // Always keep the badEvictionRange
  if (badEvictionRange) {
    for (let blockIndex = badEvictionRange.start; blockIndex < badEvictionRange.end; ++blockIndex) {
      const sizeInBytes = blockSizesInBytes[blockIndex];

      if (sizeInBytes != undefined && !blockIndexesToKeep.has(blockIndex)) {
        blockIndexesToKeep.add(blockIndex);
        cacheSizeInBytes += sizeInBytes;
      }
    }
  }

  // Go through all the ranges, from most to least recent.
  for (let blockRangeIndex = 0; blockRangeIndex < recentBlockRanges.length; blockRangeIndex++) {
    const blockRange = recentBlockRanges[blockRangeIndex] as Range;
    // Work through blocks from highest priority to lowest. Break and discard low-priority blocks if
    // we exceed our memory budget.
    const { startIndex, endIndex, increment } = getBlocksToKeepDirection(
      blockRange,
      badEvictionRange?.start,
    );

    for (let blockIndex = startIndex; blockIndex !== endIndex; blockIndex += increment) {
      // If we don't have size, there are no blocks to keep!
      const sizeInBytes = blockSizesInBytes[blockIndex];

      if (sizeInBytes == undefined) {
        continue;
      }

      // Then always add the block. But only add to `cacheSizeInBytes` if we didn't already count it.
      if (!blockIndexesToKeep.has(blockIndex)) {
        blockIndexesToKeep.add(blockIndex);
        cacheSizeInBytes += sizeInBytes;
      }

      // Terminate if we have exceeded `maxCacheSizeInBytes`.
      if (cacheSizeInBytes > maxCacheSizeInBytes) {
        const newRecentRangesExcludingBadEvictionRange = [
          ...recentBlockRanges.slice(0, blockRangeIndex),
          increment > 0
            ? {
                start: 0,
                end: blockIndex + 1,
              }
            : {
                start: blockIndex,
                end: blockRange.end,
              },
        ];
        const newRecentRanges =
          badEvictionRange == undefined
            ? newRecentRangesExcludingBadEvictionRange
            : mergeNewRangeIntoUnsortedNonOverlappingList(
                badEvictionRange,
                newRecentRangesExcludingBadEvictionRange,
              );
        return {
          blockIndexesToKeep,
          // Adjust the oldest `newRecentRanges`.
          newRecentRanges,
        };
      }
    }
  }

  return {
    blockIndexesToKeep,
    newRecentRanges: recentBlockRanges,
  };
}

// Helper to identify which end of a block range is most appropriate to evict when there is an open
// read request.
// Note: This function would work slightly better if it took a `badEvictionRange` instead of a
// `badEvictionLocation`, but it's more complex and only manifests in quite uncommon use-cases.

function getBlocksToKeepDirection(
  blockRange: Range,
  badEvictionLocation: number | undefined,
): {
  startIndex: number;
  endIndex: number;
  increment: number;
} {
  if (
    badEvictionLocation != undefined &&
    Math.abs(badEvictionLocation - blockRange.start) <
      Math.abs(badEvictionLocation - blockRange.end)
  ) {
    // Read request is closer to the start of the block than the end. Keep blocks from the start
    // with highest priority.
    return {
      startIndex: blockRange.start,
      endIndex: blockRange.end,
      increment: 1,
    };
  }

  // In most cases, keep blocks from the end with highest priority.
  return {
    startIndex: blockRange.end - 1,
    endIndex: blockRange.start - 1,
    increment: -1,
  };
}

// Get the best place to start prefetching a block, given the uncached ranges and the cursor position.
// In order of preference, we would like to prefetch:
// - The leftmost uncached block to the right of the cursor, or
// - The leftmost uncached block to the left of the cursor, if one does not exist to the right.
//
// Exported for tests.
export function getPrefetchStartPoint(uncachedRanges: Range[], cursorPosition: number): number {
  uncachedRanges.sort((a, b) => {
    if (a.start < cursorPosition !== b.start < cursorPosition) {
      // On different sides of the cursor. `a` comes first if it's to the right.
      return a.start < cursorPosition ? 1 : -1;
    }

    return a.start - b.start;
  });
  return uncachedRanges[0]?.start ?? 0;
}

// This fills up the memory with messages from an underlying RandomAccessDataProvider. The messages have to be
// unparsed ROS messages. The messages are evicted from this in-memory cache based on some constants
// defined at the top of this file.
export default class MemoryCacheDataProvider implements RandomAccessDataProvider {
  private _provider: RandomAccessDataProvider;
  private _extensionPoint?: ExtensionPoint;

  // The actual blocks that contain the messages. Blocks have a set "width" in terms of nanoseconds
  // since the start time of the bag. If a block has some messages for a topic, then by definition
  // it has *all* messages for that topic and timespan.
  private _blocks: (MemoryCacheBlock | undefined)[] = [];

  // The start time of the bag. Used for computing from and to nanoseconds since the start.
  private _startTime: Time = { sec: 0, nsec: 0 };

  // The topics that we were most recently asked to load.
  // This is always set by the last `getMessages` call.
  private _preloadTopics: string[] = [];

  // Total length of the data in nanoseconds. Used to compute progress with.
  private _totalNs: number = 0;

  // The current "connection", which represents the range that we're downloading.
  private _currentConnection?: {
    id: string;
    topics: string[];
    remainingBlockRange: Range;
  };

  // The read requests we've received via `getMessages`.
  private _readRequests: {
    // Actual range of messages, in nanoseconds since `this._startTime`.
    timeRange: Range;
    // The range of blocks.
    blockRange: Range;
    topics: string[];
    resolve: (arg0: GetMessagesResult) => void;
  }[] = [];

  // Recently requested ranges of blocks, sorted by most recent to least recent. There should never
  // be any overlapping ranges. Ranges *are* allowed to cover blocks that haven't been downloaded
  // (yet).
  private _recentBlockRanges: Range[] = [];

  // The end time of the last callback that we've resolved. This is useful for preloading new data
  // around this time.
  private _lastResolvedCallbackEnd?: number;

  // When we log a "block too large" error, we only want to do that once, to prevent
  // spamming errors.
  private _loggedTooLargeError: boolean = false;

  // If we're configured to use an unlimited cache, we try to just load as much as possible and
  // never evict anything.
  private _cacheSizeBytes: number;
  private _readAheadBlocks: number = 0;
  private _memCacheBlockSizeNs: number = 0;

  private _lazyMessageReadersByTopic = new Map<string, LazyMessageReader>();

  constructor(
    { unlimitedCache = false }: { unlimitedCache?: boolean },
    children: RandomAccessDataProviderDescriptor[],
    getDataProvider: GetDataProvider,
  ) {
    this._cacheSizeBytes = unlimitedCache ? Infinity : DEFAULT_CACHE_SIZE_BYTES;
    const child = children[0];
    if (children.length !== 1 || !child) {
      throw new Error(
        `Incorrect number of children to MemoryCacheDataProvider: ${children.length}`,
      );
    }

    this._provider = getDataProvider(child);
  }

  async initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    this._extensionPoint = extensionPoint;
    const result = await this._provider.initialize({
      ...extensionPoint,
      progressCallback: () => {},
    });
    this._startTime = result.start;
    this._totalNs = Number(toNanoSec(subtractTimes(result.end, result.start))) + 1; // +1 since times are inclusive.

    this._memCacheBlockSizeNs = Math.ceil(
      Math.max(MIN_MEM_CACHE_BLOCK_SIZE_NS, this._totalNs / MAX_BLOCKS),
    );
    this._readAheadBlocks = Math.ceil(READ_AHEAD_NS / this._memCacheBlockSizeNs);

    if (this._totalNs > Number.MAX_SAFE_INTEGER * 0.9) {
      throw new Error("Time range is too long to be supported");
    }

    const blockCount = Math.ceil(this._totalNs / this._memCacheBlockSizeNs);
    this._blocks = Array.from({ length: blockCount });

    const msgDefs = result.messageDefinitions;
    if (msgDefs.type === "parsed") {
      for (const [topic, msgDef] of Object.entries(msgDefs.parsedMessageDefinitionsByTopic)) {
        this._lazyMessageReadersByTopic.set(topic, new LazyMessageReader(msgDef));
      }
    } else if (msgDefs.type === "raw") {
      for (const [topic, rawMsgDef] of Object.entries(msgDefs.messageDefinitionsByTopic)) {
        const msgDef = parseMessageDefinition(rawMsgDef);
        this._lazyMessageReadersByTopic.set(topic, new LazyMessageReader(msgDef));
      }
    }

    this._updateProgress();

    return result;
  }

  // Potentially performance-sensitive; await can be expensive
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  getMessages(
    startTime: Time,
    endTime: Time,
    subscriptions: GetMessagesTopics,
  ): Promise<GetMessagesResult> {
    // We might have a new set of topics.
    const topics = getNormalizedTopics(subscriptions.parsedMessages ?? []);
    this._preloadTopics = topics; // Push a new entry to `this._readRequests`, and call `this._updateState()`.

    const timeRange = {
      start: Number(toNanoSec(subtractTimes(startTime, this._startTime))),
      end: Number(toNanoSec(subtractTimes(endTime, this._startTime))) + 1, // `Range` defines `end` as exclusive.
    };
    const blockRange = {
      start: Math.floor(timeRange.start / this._memCacheBlockSizeNs),
      end: Math.floor((timeRange.end - 1) / this._memCacheBlockSizeNs) + 1, // `Range` defines `end` as exclusive.
    };
    return new Promise((resolve) => {
      this._readRequests.push({
        timeRange,
        blockRange,
        topics,
        resolve,
      });

      this._updateState();
    });
  }

  async close(): Promise<void> {
    delete this._currentConnection; // Make sure that the current "connection" loop stops executing.

    return await this._provider.close();
  }

  // We're primarily interested in the topics for the first outstanding read request, and after that
  // we're interested in preloading topics (based on the *last* read request).
  private _getCurrentTopics(): string[] {
    if (this._readRequests[0]) {
      return this._readRequests[0].topics;
    }

    return this._preloadTopics;
  }

  private _resolveFinishedReadRequests(): void {
    this._readRequests = this._readRequests.filter(({ timeRange, blockRange, topics, resolve }) => {
      if (topics.length === 0) {
        resolve({
          parsedMessages: [],
          rosBinaryMessages: undefined,
        });
        return false;
      }

      // If any of the requested blocks are not fully downloaded yet, bail out.
      for (let blockIndex = blockRange.start; blockIndex < blockRange.end; blockIndex++) {
        const block = this._blocks[blockIndex];

        if (!block) {
          return true;
        }

        for (const topic of topics) {
          if (!block.messagesByTopic[topic]) {
            return true;
          }
        }
      }

      // Now that we know we have the blocks and messages, read them, and filter out just the
      // messages for the requested time range and topics.
      const messages = [];

      for (let blockIndex = blockRange.start; blockIndex < blockRange.end; blockIndex++) {
        const block = this._blocks[blockIndex];

        if (!block) {
          throw new Error("Block should have been available, but it was not");
        }

        for (const topic of topics) {
          const messagesFromBlock = block.messagesByTopic[topic];

          if (!messagesFromBlock) {
            throw new Error("Block messages should have been available, but they were not");
          }

          for (const message of messagesFromBlock) {
            const messageTime = toNanoSec(subtractTimes(message.receiveTime, this._startTime));

            if (
              timeRange.start <=
                /* inclusive */
                messageTime &&
              messageTime < timeRange.end
              /* exclusive */
            ) {
              messages.push(message);
            }
          }
        }
      }

      resolve({
        parsedMessages: messages.sort((a, b) => compare(a.receiveTime, b.receiveTime)),
        rosBinaryMessages: undefined,
      });
      this._lastResolvedCallbackEnd = blockRange.end;
      return false;
    });
  }

  // Gets called any time our "connection", read requests, or topics change.
  private _updateState(): void {
    // First, see if there are any read requests that we can resolve now.
    this._resolveFinishedReadRequests();

    if (
      this._currentConnection &&
      !isEqual(this._currentConnection.topics, this._getCurrentTopics())
    ) {
      // If we have a different set of topics, stop the current "connection", and refresh everything.
      delete this._currentConnection;
    }

    // Then see if we need to set a new connection based on the new connection and read requests state.
    void this._maybeRunNewConnections();
  }

  private _getNewConnection(): Range | undefined {
    const connectionForReadRange = getNewConnection({
      currentRemainingRange: this._currentConnection
        ? this._currentConnection.remainingBlockRange
        : undefined,
      readRequestRange: this._readRequests[0] ? this._readRequests[0].blockRange : undefined,
      downloadedRanges: this._getDownloadedBlockRanges(),
      lastResolvedCallbackEnd: this._lastResolvedCallbackEnd,
      cacheSize: this._readAheadBlocks,
      fileSize: this._blocks.length,
      continueDownloadingThreshold: 10, // Somewhat arbitrary number to not create new connections all the time.
    });

    if (connectionForReadRange) {
      return connectionForReadRange;
    }

    const cacheBytesUsed = sum(filterMap(this._blocks, (block) => block?.sizeInBytes));

    if (!this._currentConnection && cacheBytesUsed < this._cacheSizeBytes) {
      // All read requests have been served, but we have free cache space available. Cache something
      // useful if possible.
      return this._getPrefetchRange();
    }
    // Either a good connection is already in progress, or we've served all connections and have
    // nothing useful to prefetch.
    return undefined;
  }

  private _getPrefetchRange(): Range | undefined {
    const bounds = {
      start: 0,
      end: this._blocks.length,
    };
    const uncachedRanges = missingRanges(bounds, this._getDownloadedBlockRanges());

    if (uncachedRanges.length === 0) {
      return undefined; // We have loaded the whole file.
    }

    const prefetchStart = getPrefetchStartPoint(uncachedRanges, this._lastResolvedCallbackEnd ?? 0);
    // Just request a single block. We know there's at least one there, and we don't want to cause
    // blocks that are actually useful to be evicted because of our prefetching. We could consider
    // a "low priority" connection that aborts as soon as there's memory pressure.
    return {
      start: prefetchStart,
      end: prefetchStart + 1,
    };
  }

  private async _maybeRunNewConnections(): Promise<void> {
    for (;;) {
      const newConnection = this._getNewConnection();

      if (!newConnection) {
        // All read requests done and nothing to prefetch, or there is a good connection already in
        // progress.
        break;
      }

      const connectionSuccess = await this._setConnection(newConnection).catch((err) => {
        sendNotification(
          `MemoryCacheDataProvider connection ${
            this._currentConnection ? this._currentConnection.id : ""
          }`,
          err?.message ?? "<unknown error>",
          "app",
          "error",
        );
      });

      if (connectionSuccess !== true) {
        // Connection interrupted, or otherwise unsuccessful.
        break;
      }
      // See if there are any more read requests we should field.
    }
  }

  // Replace the current connection with a new one, spanning a certain range of blocks. Return whether we
  // completed successfully, or whether we were interrupted by another connection.
  private async _setConnection(blockRange: Range): Promise<boolean> {
    if (this._getCurrentTopics().length === 0) {
      delete this._currentConnection;
      return true;
    }

    const id = uuidv4();
    this._currentConnection = {
      id,
      topics: this._getCurrentTopics(),
      remainingBlockRange: blockRange,
    }; // Merge the new `blockRange` into `_recentBlockRanges`, which upholds the invariant that
    // these ranges are never overlapping.

    this._recentBlockRanges = mergeNewRangeIntoUnsortedNonOverlappingList(
      blockRange,
      this._recentBlockRanges,
    );

    const isCurrent = () => {
      return this._currentConnection?.id === id;
    };

    // Just loop infinitely, but break if the connection is not current any more.
    for (;;) {
      const currentConnection = this._currentConnection;
      if (!isCurrent()) {
        return false;
      }

      const currentBlockIndex: number = currentConnection.remainingBlockRange.start;
      // Only request topics that we don't already have.
      const topics = this._blocks[currentBlockIndex]
        ? currentConnection.topics.filter(
            (topic) => !this._blocks[currentBlockIndex]?.messagesByTopic[topic],
          )
        : currentConnection.topics;
      // Get messages from the underlying provider.
      const startTime = addTimes(
        this._startTime,
        fromNanoSec(BigInt(currentBlockIndex * this._memCacheBlockSizeNs)),
      );
      const endTime = addTimes(
        this._startTime,
        fromNanoSec(
          BigInt(Math.min(this._totalNs, (currentBlockIndex + 1) * this._memCacheBlockSizeNs) - 1),
        ), // endTime is inclusive.
      );
      const messages =
        topics.length > 0
          ? await this._provider.getMessages(startTime, endTime, {
              rosBinaryMessages: topics,
            })
          : {
              rosBinaryMessages: [],
              parsedMessages: undefined,
            };
      const { rosBinaryMessages, parsedMessages } = messages;

      if (parsedMessages != undefined) {
        const types = (Object.keys(messages) as (keyof typeof messages)[])
          .filter((type) => messages[type] != undefined)
          .join("\n");
        sendNotification("MemoryCacheDataProvider got bad message types", types, "app", "error");
        // Do not retry.
        return false;
      }

      // If we're not current any more, discard the messages, because otherwise we might write duplicate messages.
      if (!isCurrent()) {
        return false;
      }

      const existingBlock = this._blocks[currentBlockIndex] ?? EMPTY_BLOCK;
      const messagesByTopic = { ...existingBlock.messagesByTopic };
      let sizeInBytes = existingBlock.sizeInBytes;
      // Fill up the block with messages.
      for (const topic of topics) {
        messagesByTopic[topic] = [];
      }

      for (const rosBinaryMessage of rosBinaryMessages ?? []) {
        const lazyReader = this._lazyMessageReadersByTopic.get(rosBinaryMessage.topic);
        if (!lazyReader) {
          continue;
        }

        sizeInBytes += rosBinaryMessage.message.byteLength;

        const bytes = new Uint8Array(rosBinaryMessage.message);

        try {
          const msgSize = lazyReader.size(bytes);
          if (msgSize > bytes.byteLength) {
            sendNotification(
              `Message buffer not large enough on ${rosBinaryMessage.topic}`,
              `Cannot read ${msgSize} byte message from ${bytes.byteLength} byte buffer`,
              "user",
              "error",
            );
          }
        } catch (error) {
          sendNotification(
            `Message size parsing failed on ${rosBinaryMessage.topic}`,
            error,
            "user",
            "error",
          );
        }

        const lazyMsg = lazyReader.readMessage(bytes);
        messagesByTopic[rosBinaryMessage.topic]?.push({
          topic: rosBinaryMessage.topic,
          receiveTime: rosBinaryMessage.receiveTime,
          message: lazyMsg,
        });
      }

      if (sizeInBytes > MAX_BLOCK_SIZE_BYTES && !this._loggedTooLargeError) {
        this._loggedTooLargeError = true;

        sendNotification(
          "Very large block found",
          `A very large block (${Math.round(
            this._memCacheBlockSizeNs / 1e6,
          )}ms) was found: ${Math.round(
            sizeInBytes / 1e6,
          )}MB. Too much data can cause performance problems and even crashes. Please fix this where the data is being generated.`,
          "user",
          "warn",
        );
      }

      this._blocks = this._blocks.slice(0, currentBlockIndex).concat(
        [
          {
            messagesByTopic,
            sizeInBytes,
          },
        ],
        this._blocks.slice(currentBlockIndex + 1),
      );
      // Now `this._recentBlockRanges` and `this._blocks` have been updated, so we can resolve
      // requests, purge the cache and report progress.
      this._resolveFinishedReadRequests();
      this._purgeOldBlocks();
      this._updateProgress();

      // Check *again* if we're not current any more, because now we're going to update connection
      // information.
      if (!isCurrent()) {
        return false;
      }

      if (currentBlockIndex >= blockRange.end - 1) {
        // If we're at the end of the range, we're done.
        break;
      }

      // Otherwise, update the `remainingBlockRange`.
      this._currentConnection = {
        ...this._currentConnection,
        remainingBlockRange: {
          start: currentBlockIndex + 1,
          end: blockRange.end,
        },
      };
    }

    // Connection successfully completed.
    delete this._currentConnection;
    return true;
  }

  // For the relevant downloaded ranges, we look at `this._blocks` and the most relevant topics.
  private _getDownloadedBlockRanges(): Range[] {
    const topics: string[] = this._getCurrentTopics();

    return simplify(
      filterMap(this._blocks, (block, blockIndex) => {
        if (!block) {
          return;
        }

        for (const topic of topics) {
          if (!block.messagesByTopic[topic]) {
            return;
          }
        }

        return {
          start: blockIndex,
          end: blockIndex + 1,
        };
      }),
    );
  }

  private _purgeOldBlocks(): void {
    if (this._cacheSizeBytes === Infinity) {
      return;
    }

    // If we have open read requests, we really don't want to evict blocks in the first one because
    // we're actively trying to fill it.
    // If we don't have open read requests, don't evict blocks in the read-ahead range (ahead of the
    // playback cursor) because we'll automatically try to refetch that data immediately after.
    let badEvictionRange = this._readRequests[0]?.blockRange;

    if (!badEvictionRange && this._lastResolvedCallbackEnd != undefined) {
      badEvictionRange = {
        start: this._lastResolvedCallbackEnd,
        end: this._lastResolvedCallbackEnd + this._readAheadBlocks,
      };
    }

    // Call the getBlocksToKeep helper.
    const { blockIndexesToKeep, newRecentRanges } = getBlocksToKeep({
      recentBlockRanges: this._recentBlockRanges,
      blockSizesInBytes: this._blocks.map((block) => block?.sizeInBytes ?? 0),
      maxCacheSizeInBytes: this._cacheSizeBytes,
      badEvictionRange,
    });

    // Update our state.
    this._recentBlockRanges = newRecentRanges;
    const newBlocks: (MemoryCacheBlock | undefined)[] = Array.from({ length: this._blocks.length });

    for (let blockIndex = 0; blockIndex < this._blocks.length; blockIndex++) {
      if (this._blocks[blockIndex] && blockIndexesToKeep.has(blockIndex)) {
        newBlocks[blockIndex] = this._blocks[blockIndex];
      }
    }

    this._blocks = newBlocks;
  }

  private _updateProgress(): void {
    this._extensionPoint?.progressCallback({
      fullyLoadedFractionRanges: this._getDownloadedBlockRanges().map((range) => ({
        // Convert block ranges into fractions.
        start: range.start / this._blocks.length,
        end: range.end / this._blocks.length,
      })),
      messageCache: {
        blocks: this._blocks,
        startTime: this._startTime,
      },
    });
  }

  setCacheSizeBytesInTests(cacheSizeBytes: number): void {
    this._cacheSizeBytes = cacheSizeBytes;
  }
}
