// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isEqual, sortedIndexBy } from "lodash";

import { minIndexBy, sortedIndexByTuple } from "@foxglove/den/collection";
import Log from "@foxglove/log";
import { subtract, add, toNanoSec, compare } from "@foxglove/rostime";
import { Time, MessageEvent } from "@foxglove/studio";
import { Range } from "@foxglove/studio-base/util/ranges";

import {
  GetBackfillMessagesArgs,
  IIterableSource,
  Initalization,
  IteratorResult,
  MessageIteratorArgs,
} from "./IIterableSource";

const log = Log.getLogger(__filename);

// An individual cache item represents a continuous range of CacheIteratorItems
type CacheBlock = {
  // The start time of the cache item (inclusive).
  //
  // When reading a data source, the first message may come after the requested "start" time.
  // The start field is the request start time while the first item in items would be the first message
  // which may be after this time.
  //
  // The start time is <= first item time.
  start: Time;

  // The end time (inclusive) of the last message within the cache item. Similar to start, the data source
  // may "end" after the last message so.
  //
  // The end time is >= last item time.
  end: Time;

  // Sorted cache item tuples. The first value is the timestamp of the iterator result and the second is the result.
  items: [bigint, IteratorResult][];

  // The last time this block was accessed.
  lastAccess: number;

  // The size of this block in bytes
  size: number;
};

type Options = {
  maxBlockSize?: number;
  maxTotalSize?: number;
};

/**
 * CachingIterableSource proxies access to IIterableSource through a memory buffer.
 *
 * Message reading occurs from the memory buffer containing previously read messages. If there is no
 * buffer for previously read messages, then the underlying source is used and the messages are
 * cached when read.
 */
class CachingIterableSource implements IIterableSource {
  private source: IIterableSource;

  // Stores which topics we have been caching. See notes at usage site for why we store this.
  private cachedTopics: string[] = [];

  // The producer loads results into the cache and the consumer reads from the cache.
  private cache: CacheBlock[] = [];

  // Cache of loaded ranges. Ranges correspond to the cache blocks and are normalized in [0, 1];
  private loadedRangesCache: Range[] = [{ start: 0, end: 0 }];

  private initResult?: Initalization;

  private totalSizeBytes: number = 0;

  // Maximum total cache size
  private maxTotalSizeBytes: number;

  // Maximum size per block
  private maxBlockSizeBytes: number;

  public constructor(source: IIterableSource, opt?: Options) {
    this.source = source;
    this.maxTotalSizeBytes = opt?.maxTotalSize ?? 1073741824; // 1GB
    this.maxBlockSizeBytes = opt?.maxBlockSize ?? 52428800; // 50MB
  }

  public async initialize(): Promise<Initalization> {
    this.initResult = await this.source.initialize();
    return this.initResult;
  }

  public async terminate(): Promise<void> {
    this.cache.length = 0;
    this.cachedTopics.length = 0;
  }

  public loadedRanges(): Range[] {
    return this.loadedRangesCache;
  }

  public async *messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    if (!this.initResult) {
      throw new Error("Invariant: uninitialized");
    }

    const maxEnd = args.end ?? this.initResult.end;
    const maxEndNanos = toNanoSec(maxEnd);

    const newTopics = [...args.topics].sort();

    // When the list of topics we want changes we purge the entire cache and start again.
    // This is heavy-handed but avoids dealing with how to handle disjoint cached ranges across topics.
    if (!isEqual(newTopics, this.cachedTopics)) {
      log.debug("topics changed - clearing cache, resetting range");
      this.cachedTopics = newTopics;
      this.cache.length = 0;
      this.totalSizeBytes = 0;
      this.recomputeLoadedRangeCache();
    }

    // Where we want to read messages from. As we move through blocks and messages, the read head
    // moves forward to track the next place we should be reading.
    let readHead = args.start ?? this.initResult.start;

    for (;;) {
      if (compare(readHead, maxEnd) > 0) {
        break;
      }

      const cacheBlockIndex = this.cache.findIndex((item) => {
        return compare(item.start, readHead) <= 0 && compare(item.end, readHead) >= 0;
      });

      let block = this.cache[cacheBlockIndex];

      // if the block start === end and done is false, then it could have been a new block we started but never
      // got around to adding any messages into, we remove it.
      if (block && compare(block.start, block.end) === 0 && block.items.length === 0) {
        block = undefined;
        this.cache.splice(cacheBlockIndex, 1);
        continue;
      }

      // We've found a block containing our readHead, try reading items from the block
      if (block) {
        const cacheIndex = CachingIterableSource.FindStartCacheItemIndex(
          block.items,
          toNanoSec(readHead),
        );

        // We have a cached item, we can consume our cache until we've read to the end
        for (let idx = cacheIndex; idx < block.items.length; ++idx) {
          const cachedItem = block.items[idx];
          if (!cachedItem) {
            break;
          }

          // We may have found a cached time that is after our max iterator time.
          // We bail with no return when that happens.
          if (cachedItem[0] > maxEndNanos) {
            return;
          }

          // update the last time this block was accessed
          block.lastAccess = Date.now();

          yield cachedItem[1];
        }

        // We've read all the messages cached for the block, this means our next read can start
        // at 1 nanosecond after the end of the block because we know that block.end is inclusive
        // of all the messages our block represents.
        readHead = add(block.end, { sec: 0, nsec: 1 });
        continue;
      }

      // We don't have a block for our readHead which meas we need to read from the source.
      // We start reading from the source where the readHead is. We end reading from the source
      // where the next block starts (or source.end if there is no next block)

      // The block (and source) will start at the read head
      const sourceReadStart = readHead;

      // Look for the block that comes after our read head
      const nextBlockIndex = this.cache.findIndex((item) => {
        // Find the first index where readHead is less than an existing start
        return compare(readHead, item.start) < 0;
      });

      // If we have a next block (this is the block ours would come before), then we only need
      // to read up to that block.
      const nextBlock = this.cache[nextBlockIndex];

      let sourceReadEnd = nextBlock ? subtract(nextBlock.start, { sec: 0, nsec: 1 }) : maxEnd;

      if (compare(sourceReadStart, sourceReadEnd) > 0) {
        throw new Error("Invariant: sourceReadStart > sourceReadEnd");
      }

      // When reading for our message iterator, we might have a nextBlock that starts
      // after the end time we want to read. This limits our reading to the end time of the iterator.
      if (compare(sourceReadEnd, maxEnd) > 0) {
        sourceReadEnd = maxEnd;
      }

      const sourceMessageIterator = this.source.messageIterator({
        topics: this.cachedTopics,
        start: sourceReadStart,
        end: sourceReadEnd,
        consumptionType: args.consumptionType,
      });

      // The cache is indexed on time, but iterator results that are problems might not have a time.
      // For these we use the lastTime that we knew about (or had a message for).
      // This variable tracks the last known time from a read.
      let lastTime = toNanoSec(sourceReadStart);

      const pendingIterResults: [bigint, IteratorResult][] = [];

      for await (const iterResult of sourceMessageIterator) {
        // if there is no block, we make a new block
        if (!block) {
          const newBlock: CacheBlock = {
            start: readHead,
            end: readHead,
            items: [],
            size: 0,
            lastAccess: Date.now(),
          };

          // Find where we need to insert our new block.
          // It should come before any blocks with a start time > than new block start time.
          const insertIndex = sortedIndexBy(this.cache, newBlock, (item) => toNanoSec(item.start));
          this.cache.splice(insertIndex, 0, newBlock);

          block = newBlock;
          this.recomputeLoadedRangeCache();
        }

        // When receiving a message event or stamp, we update our known time on the block to the
        // stamp or receiveTime because we know we've received all the results up to this time
        if (iterResult.type === "message-event" || iterResult.type === "stamp") {
          const receiveTime =
            iterResult.type === "stamp" ? iterResult.stamp : iterResult.msgEvent.receiveTime;
          const receiveTimeNs = toNanoSec(receiveTime);

          // There might be multiple messages at the same time, and since block end time
          // is inclusive we only update the end time once we've moved to the next time
          if (receiveTimeNs > lastTime) {
            // write any pending messages to the block
            for (const pendingIterResult of pendingIterResults) {
              const item = pendingIterResult[1];
              const pendingSizeInBytes =
                item.type === "message-event" ? item.msgEvent.sizeInBytes : 0;
              block.items.push(pendingIterResult);
              block.size += pendingSizeInBytes;
            }

            pendingIterResults.length = 0;

            // update the last time this block was accessed
            block.lastAccess = Date.now();

            // Set the end time to 1 nanosecond before the current receive time since we know we've
            // read up to this receive time.
            block.end = subtract(receiveTime, { sec: 0, nsec: 1 });

            lastTime = receiveTimeNs;
            this.recomputeLoadedRangeCache();
          }
        }

        // Block is too big so we close it and will start a new one next loop
        if (block.size >= this.maxBlockSizeBytes) {
          // The new block starts right after our previous one
          readHead = add(block.end, { sec: 0, nsec: 1 });

          // Will force creation of a new block on the next loop
          block = undefined;
        }

        const sizeInBytes =
          iterResult.type === "message-event" ? iterResult.msgEvent.sizeInBytes : 0;
        if (this.maybePurgeCache({ activeBlock: block, sizeInBytes })) {
          this.recomputeLoadedRangeCache();
        }

        // As we add items to pending we also consider them as part of the total size
        this.totalSizeBytes += sizeInBytes;

        // Store the latest message in pending results and flush to the block when time moves forward
        pendingIterResults.push([lastTime, iterResult]);

        yield iterResult;
      }

      // We've finished reading our source to the end, close out the block
      if (block) {
        block.end = sourceReadEnd;

        // update the last time this block was accessed
        block.lastAccess = Date.now();

        // write any pending messages to the block
        for (const pendingIterResult of pendingIterResults) {
          const item = pendingIterResult[1];
          const pendingSizeInBytes = item.type === "message-event" ? item.msgEvent.sizeInBytes : 0;
          block.items.push(pendingIterResult);
          block.size += pendingSizeInBytes;
        }

        this.recomputeLoadedRangeCache();
      } else {
        // We don't have a block after finishing our source. This can happen if the last
        // thing we read in the source made our block be over size and we cycled to a new block.
        // This can also happen if there were no messages in our source range.
        //
        // Since we never loop again we need to insert an empty block from the readHead
        // to sourceReadEnd because we know there's nothing else in that range.
        const newBlock: CacheBlock = {
          start: readHead,
          end: sourceReadEnd,
          items: pendingIterResults,
          size: 0,
          lastAccess: Date.now(),
        };

        for (const pendingIterResult of pendingIterResults) {
          const item = pendingIterResult[1];
          const pendingSizeInBytes = item.type === "message-event" ? item.msgEvent.sizeInBytes : 0;
          newBlock.size += pendingSizeInBytes;
        }

        // Find where we need to insert our new block.
        // It should come before any blocks with a start time > than new block start time.
        const insertIndex = sortedIndexBy(this.cache, newBlock, (item) => toNanoSec(item.start));
        this.cache.splice(insertIndex, 0, newBlock);

        this.recomputeLoadedRangeCache();
      }

      // We've read everything there was to read for this source, so our next read will be after
      // the end of this source
      readHead = add(sourceReadEnd, { sec: 0, nsec: 1 });
    }
  }

  public async getBackfillMessages(
    args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<unknown>[]> {
    if (!this.initResult) {
      throw new Error("Invariant: uninitialized");
    }

    // Find a block that contains args.time. We must find a block that contains args.time rather
    // than one that occurs anytime before args.time to correctly get the last message before
    // args.time rather than any message that occurs before args.time.
    const cacheBlockIndex = this.cache.findIndex((item) => {
      return compare(item.start, args.time) <= 0 && compare(item.end, args.time) >= 0;
    });

    const out: MessageEvent<unknown>[] = [];
    const needsTopics = new Set(args.topics);

    // Starting at the block we found for args.time, work backwards through blocks until:
    // * we've loaded all the topics
    // * we have a gap between our block and the previous block
    //
    // We must stop going backwards when we have a gap because we can no longer know if the source
    // actually does have messages in the gap.
    for (let idx = cacheBlockIndex; idx >= 0 && needsTopics.size > 0; --idx) {
      const cacheBlock = this.cache[idx];
      if (!cacheBlock) {
        break;
      }

      const targetTime = toNanoSec(args.time);
      let readIdx = sortedIndexByTuple(cacheBlock.items, targetTime);

      // If readIdx is negative then we don't have an exact match, but readIdx does tell us what that is
      // See the findCacheItem documentation for how to interpret it.
      if (readIdx < 0) {
        readIdx = ~readIdx;

        // readIdx will point to the element after our time (or 1 past the end of the array)
        // We subtract 1 to start reading from before that element or end of array
        readIdx -= 1;
      } else {
        // When readIdx is an exact match we get a positive value. For an exact match we traverse
        // forward linearly to find the last occurrence of the matching timestamp in our cache
        // block. We can then read backwards in the block to find the last messages on all requested
        // topics.
        for (let i = readIdx + 1; i < cacheBlock.items.length; ++i) {
          if (cacheBlock.items[i]?.[0] !== targetTime) {
            break;
          }
          readIdx = i;
        }
      }

      for (let i = readIdx; i >= 0; --i) {
        const record = cacheBlock.items[i];
        if (!record || record[1].type !== "message-event") {
          continue;
        }

        const msgEvent = record[1].msgEvent;
        if (needsTopics.has(msgEvent.topic)) {
          needsTopics.delete(msgEvent.topic);
          out.push(msgEvent);
        }
      }

      const prevBlock = this.cache[idx - 1];
      // If we have a gap between the start of our block and the previous block, then we must stop
      // trying to read from the block cache
      if (prevBlock && compare(add(prevBlock.end, { sec: 0, nsec: 1 }), cacheBlock.start) !== 0) {
        break;
      }
    }

    // If we found all our topics from our cache then we don't need to fallback to the source
    if (needsTopics.size === 0) {
      return out;
    }

    // fallback to the source for any topics we weren't able to load
    const sourceBackfill = await this.source.getBackfillMessages({
      ...args,
      topics: Array.from(needsTopics),
    });

    out.push(...sourceBackfill);
    out.sort((a, b) => compare(a.receiveTime, b.receiveTime));

    return out;
  }

  private recomputeLoadedRangeCache(): void {
    if (!this.initResult) {
      throw new Error("Invariant: uninitialized");
    }

    // The nanosecond time of the start of the source
    const sourceStartNs = toNanoSec(this.initResult.start);

    const rangeNs = Number(toNanoSec(subtract(this.initResult.end, this.initResult.start)));
    if (rangeNs === 0) {
      this.loadedRangesCache = [{ start: 0, end: 1 }];
      return;
    }

    if (this.cache.length === 0) {
      this.loadedRangesCache = [{ start: 0, end: 0 }];
      return;
    }

    // Merge continuous ranges (i.e. a block that starts 1 nanosecond after previous ends)
    // This avoids float rounding errors when computing loadedRangesCache and produces
    // continuous ranges for continuous spans
    const ranges: { start: number; end: number }[] = [];
    let prevRange: { start: bigint; end: bigint } | undefined;
    for (const block of this.cache) {
      const range = {
        start: toNanoSec(block.start),
        end: toNanoSec(block.end),
      };
      if (!prevRange) {
        prevRange = range;
      } else if (prevRange.end + 1n === range.start) {
        prevRange.end = range.end;
      } else {
        ranges.push({
          start: Number(prevRange.start - sourceStartNs) / rangeNs,
          end: Number(prevRange.end - sourceStartNs) / rangeNs,
        });
        prevRange = range;
      }
    }
    if (prevRange) {
      ranges.push({
        start: Number(prevRange.start - sourceStartNs) / rangeNs,
        end: Number(prevRange.end - sourceStartNs) / rangeNs,
      });
    }

    this.loadedRangesCache = ranges;
  }

  // Purge the oldest cache block if adding sizeInBytes to the cache would exceed the maxTotalSizeBytes
  // @return true if a block was purged
  //
  // Throws if the cache block we want to purge is the active block.
  private maybePurgeCache(opt: { activeBlock?: CacheBlock; sizeInBytes: number }): boolean {
    const { activeBlock, sizeInBytes } = opt;

    // Determine if our total size would exceed max and purge the oldest block
    if (this.totalSizeBytes + sizeInBytes <= this.maxTotalSizeBytes) {
      return false;
    }

    // Find the oldest cache item
    const oldestIdx = minIndexBy(this.cache, (a, b) => a.lastAccess - b.lastAccess);

    const oldestBlock = this.cache[oldestIdx];
    if (oldestBlock) {
      if (oldestBlock === activeBlock) {
        throw new Error("Cannot evict the active cache block.");
      }
      this.totalSizeBytes -= oldestBlock.size;
      this.cache.splice(oldestIdx, 1);
      return true;
    }

    return false;
  }

  private static FindStartCacheItemIndex(items: [bigint, IteratorResult][], key: bigint) {
    // A common case is to access consecutive blocks during playback. In that case, we expect to
    // read from the first item in the block. We check this special case first to avoid a binary
    // search if we are able to find the key in the first item.
    if (items[0] != undefined && items[0][0] >= key) {
      return 0;
    }

    let idx = sortedIndexByTuple(items, key);
    if (idx < 0) {
      return ~idx;
    }

    // An exact match just means we've found a matching item, not necessarily the first or last
    // matching item. We want the first item so we linearly iterate backwards until we no longer have
    // a match.
    for (let i = idx - 1; i >= 0; --i) {
      const prevItem = items[i];
      if (prevItem != undefined && prevItem[0] !== key) {
        break;
      }
      idx = i;
    }

    return idx;
  }
}

export { CachingIterableSource };
