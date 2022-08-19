// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { simplify } from "intervals-fn";
import { isEqual } from "lodash";

import { Condvar } from "@foxglove/den/async";
import { filterMap } from "@foxglove/den/collection";
import Log from "@foxglove/log";
import {
  Time,
  subtract as subtractTimes,
  toNanoSec,
  add,
  fromNanoSec,
  clampTime,
} from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import PlayerProblemManager from "@foxglove/studio-base/players/PlayerProblemManager";
import { MessageBlock, Progress } from "@foxglove/studio-base/players/types";

import { IIterableSource } from "./IIterableSource";

const log = Log.getLogger(__filename);

type BlockLoaderArgs = {
  cacheSizeBytes: number;
  source: IIterableSource;
  start: Time;
  end: Time;
  maxBlocks: number;
  minBlockDurationNs: number;
  problemManager: PlayerProblemManager;
};

type CacheBlock = MessageBlock & {
  needTopics: Set<string>;
};

type Blocks = (CacheBlock | undefined)[];

type LoadArgs = {
  progress: (progress: Progress) => void;
};

/**
 * BlockLoader manages loading blocks from a source. Blocks are fixed time span containers for messages.
 */
export class BlockLoader {
  private source: IIterableSource;
  private blocks: Blocks = [];
  private start: Time;
  private end: Time;
  private blockDurationNanos: number;
  private topics: Set<string> = new Set();
  private maxCacheSize: number = 0;
  private activeBlockId: number = 0;
  private problemManager: PlayerProblemManager;
  private stopped: boolean = false;
  private activeChangeCondvar: Condvar = new Condvar();

  public constructor(args: BlockLoaderArgs) {
    this.source = args.source;
    this.start = args.start;
    this.end = args.end;
    this.maxCacheSize = args.cacheSizeBytes;
    this.problemManager = args.problemManager;

    const totalNs = Number(toNanoSec(subtractTimes(this.end, this.start))) + 1; // +1 since times are inclusive.
    if (totalNs > Number.MAX_SAFE_INTEGER * 0.9) {
      throw new Error("Time range is too long to be supported");
    }

    this.blockDurationNanos = Math.ceil(
      Math.max(args.minBlockDurationNs, totalNs / args.maxBlocks),
    );

    const blockCount = Math.ceil(totalNs / this.blockDurationNanos);

    log.debug(`Block count: ${blockCount}`);
    this.blocks = Array.from({ length: blockCount });
  }

  public setActiveTime(time: Time): void {
    const startTime = subtractTimes(subtractTimes(time, this.start), { sec: 1, nsec: 0 });
    const startNs = Math.max(0, Number(toNanoSec(startTime)));
    const beginBlockId = Math.floor(startNs / this.blockDurationNanos);

    if (beginBlockId === this.activeBlockId) {
      return;
    }

    this.activeBlockId = beginBlockId;
    this.activeChangeCondvar.notifyAll();
  }

  public setTopics(topics: Set<string>): void {
    if (isEqual(topics, this.topics)) {
      return;
    }

    this.topics = topics;
    this.activeChangeCondvar.notifyAll();

    // Update all the blocks with any missing topics
    for (const block of this.blocks) {
      if (block) {
        const blockTopics = Object.keys(block.messagesByTopic);
        const needTopics = new Set(topics);
        for (const topic of blockTopics) {
          needTopics.delete(topic);
        }
        block.needTopics = needTopics;
      }
    }
  }

  public async stopLoading(): Promise<void> {
    log.debug("Stop loading blocks");
    this.stopped = true;
    this.activeChangeCondvar.notifyAll();
  }

  public async startLoading(args: LoadArgs): Promise<void> {
    log.debug("Start loading process");
    this.stopped = false;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (!this.stopped) {
      const activeBlockId = this.activeBlockId;
      const topics = this.topics;

      // Load around the active block id, if the active block id changes then bail
      await this.load({ progress: args.progress });

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (this.stopped) {
        break;
      }

      // The active block id is the same as when we started.
      // Wait for it to possibly change.
      if (this.activeBlockId === activeBlockId && this.topics === topics) {
        await this.activeChangeCondvar.wait();
      }
    }
  }

  private async load(args: { progress: LoadArgs["progress"] }): Promise<void> {
    const topics = this.topics;

    // Ignore changing the blocks if the topic list is empty
    if (topics.size === 0) {
      args.progress(this.calculateProgress(topics));
      return;
    }

    // We prioritize loading from the active block id to the end, then we load from the start to active block id
    const segments: [number, number][] = [
      [this.activeBlockId, this.blocks.length],
      [0, this.activeBlockId],
    ];

    for (const segment of segments) {
      const [beginBlockId, lastBlockId] = segment;

      // Note: lastBlockId is actually 1-past-last block so we can skip this loop if the begin and last are the same
      if (beginBlockId === lastBlockId) {
        continue;
      }

      await this.loadBlockRange(beginBlockId, lastBlockId, args.progress);
    }
  }

  /// ---- private

  // Load the blocks from [beginBlockId, lastBlockId)
  private async loadBlockRange(
    beginBlockId: number,
    lastBlockId: number,
    progress: LoadArgs["progress"],
  ): Promise<void> {
    const topics = this.topics;

    let totalBlockSizeBytes = this.cacheSize();

    for (let blockId = beginBlockId; blockId < lastBlockId; ++blockId) {
      // Topics we will fetch for this range
      let topicsToFetch = new Set<string>();

      // Keep looking for a block that needs loading
      {
        const existingBlock = this.blocks[blockId];

        // The current block has everything, so we can move to the next block
        if (existingBlock?.needTopics.size === 0) {
          continue;
        }

        // The current block needs some topics so those will be come the topics we need to fetch
        topicsToFetch = existingBlock?.needTopics ?? topics;
      }

      // blockId is the first block that needs loading
      // Now we look for the last block. We do this by finding blocks that need the same topics to fetch.
      // This creates a continuous span of the same topics to fetch
      let endBlockId = blockId;
      for (let endIdx = blockId + 1; endIdx < this.blocks.length; ++endIdx) {
        const nextBlock = this.blocks[endIdx];

        const needTopics = nextBlock?.needTopics ?? topics;

        // if needtopics is undefined cause there's no block, then needTopics is all topics

        // The topics we need to fetch no longer match the topics we need so we stop the range
        if (!isEqual(topicsToFetch, needTopics)) {
          break;
        }

        endBlockId = endIdx;
      }

      const iteratorStartTime = this.blockIdToStartTime(blockId);
      const iteratorEndTime = clampTime(this.blockIdToEndTime(endBlockId), this.start, this.end);

      const iterator = this.source.messageIterator({
        topics: Array.from(topicsToFetch),
        start: iteratorStartTime,
        end: iteratorEndTime,
      });

      let messagesByTopic: Record<string, MessageEvent<unknown>[]> = {};
      // Set all topic arrays to empty to indicate we've read this topic
      for (const topic of topicsToFetch) {
        messagesByTopic[topic] = [];
      }

      let currentBlockId = blockId;

      let sizeInBytes = 0;
      for await (const iterResult of iterator) {
        if (iterResult.problem) {
          this.problemManager.addProblem(`connid-${iterResult.connectionId}`, iterResult.problem);
          continue;
        }

        const messageBlockId = this.timeToBlockId(iterResult.msgEvent.receiveTime);

        if (messageBlockId < currentBlockId) {
          log.error("Invariant: received a message for a block in the past");
          throw new Error("Invariant: received a message for a block in the past");
        }

        // Message is for a different block.
        // 1. Close out the current block.
        // 2. Fill in any block gaps.
        // 3. start a new block.
        if (messageBlockId !== currentBlockId) {
          // Close out the current block with the aggregated messages. Fill any blocks between
          // current and the new block with empty topic arrays. We can use empty arrays because we
          // know these blocks have no messages since messages arrive in time order.
          for (let idx = currentBlockId; idx < messageBlockId; ++idx) {
            const existingBlock = this.blocks[idx];

            this.blocks[idx] = {
              needTopics: new Set(),
              messagesByTopic: {
                ...existingBlock?.messagesByTopic,
                ...messagesByTopic,
              },
              sizeInBytes: sizeInBytes + (existingBlock?.sizeInBytes ?? 0),
            };

            // setup a new block cache for the next block
            messagesByTopic = {};
            // Set all topic arrays to empty to indicate we've read this topic
            for (const topic of topicsToFetch) {
              messagesByTopic[topic] = [];
            }
          }

          // Set the new block to the id of our latest message
          currentBlockId = messageBlockId;

          progress(this.calculateProgress(topics));
        }

        // When the topics change we re bail and will re-load
        // Since topics changing is in-frequent and usually indicates we need to reload blocks
        if (topics !== this.topics) {
          log.debug("topics changed, aborting load instance");
          return;
        }

        const msgTopic = iterResult.msgEvent.topic;
        const events = messagesByTopic[msgTopic];

        const problemKey = `unexpected-topic-${msgTopic}`;
        if (!events) {
          this.problemManager.addProblem(problemKey, {
            severity: "error",
            message: `Received a messaged on an unexpected topic: ${msgTopic}.`,
          });

          continue;
        }
        this.problemManager.removeProblem(problemKey);

        const messageSizeInBytes = iterResult.msgEvent.sizeInBytes;
        sizeInBytes += messageSizeInBytes;

        // Evict blocks until we have space for our new message
        while (totalBlockSizeBytes + messageSizeInBytes > this.maxCacheSize) {
          const evictedSize = this.evictBlock({
            startId: this.activeBlockId,
            endId: currentBlockId,
          });
          // If we could not evict any blocks to bring our size down, then we stop loading more data
          if (evictedSize === 0) {
            return;
          }

          totalBlockSizeBytes -= evictedSize;
        }

        // When the active block id changes, we need to check whether the active block
        // is loaded through where we are loading (or the end if active block is after currentBlockId)
        if (beginBlockId !== this.activeBlockId) {
          // minus one because the currentBlockIdx is now the next block we are loading
          // we don't need to compare to that sine we know it hasn't loaded yet but is about to be
          let scanToBlockIdx = currentBlockId - 1;

          // If the active block id > the block we scan to, then we need to scan to end
          if (this.activeBlockId > scanToBlockIdx) {
            scanToBlockIdx = this.blocks.length - 1;
          }

          // scan from active to scanToBlockId
          for (let scanIdx = this.activeBlockId; scanIdx <= scanToBlockIdx; ++scanIdx) {
            // There's a block between active and current that needs loading, we bail and restart loading
            const existingBlock = this.blocks[scanIdx];
            if (!existingBlock || existingBlock.needTopics.size > 0) {
              return;
            }
          }
        }

        totalBlockSizeBytes += messageSizeInBytes;
        events.push(iterResult.msgEvent);
      }

      // Close out the current block with the aggregated messages. Fill any blocks between
      // current and the new block with empty topic arrays. We can use empty arrays because we
      // know these blocks have no messages since messages arrive in time order.
      for (let idx = currentBlockId; idx <= endBlockId; ++idx) {
        const existingBlock = this.blocks[idx];

        this.blocks[idx] = {
          needTopics: new Set(),
          messagesByTopic: {
            ...existingBlock?.messagesByTopic,
            ...messagesByTopic,
          },
          sizeInBytes: sizeInBytes + (existingBlock?.sizeInBytes ?? 0),
        };

        messagesByTopic = {};
        // Set all topic arrays to empty to indicate we've read this topic
        for (const topic of topicsToFetch) {
          messagesByTopic[topic] = [];
        }
      }

      if (currentBlockId <= endBlockId) {
        progress(this.calculateProgress(topics));
      }

      // We've processed through endBlockId now, next cycle can skip all those blocks
      blockId = endBlockId + 1;
    }
  }

  // Evict a block while preserving blocks in the block id range (inclusive)
  private evictBlock(range: { startId: number; endId: number }): number {
    if (range.endId < range.startId) {
      for (let i = range.startId - 1; i > range.endId; --i) {
        const blockToEvict = this.blocks[i];
        if (!blockToEvict || blockToEvict.sizeInBytes === 0) {
          continue;
        }

        this.blocks[i] = undefined;
        return blockToEvict.sizeInBytes;
      }
    }

    if (range.endId > range.startId) {
      for (let i = range.startId - 1; i > 0; --i) {
        const blockToEvict = this.blocks[i];
        if (!blockToEvict || blockToEvict.sizeInBytes === 0) {
          continue;
        }

        this.blocks[i] = undefined;
        return blockToEvict.sizeInBytes;
      }

      for (let i = range.endId + 1; i < this.blocks.length; ++i) {
        const blockToEvict = this.blocks[i];
        if (!blockToEvict || blockToEvict.sizeInBytes === 0) {
          continue;
        }

        this.blocks[i] = undefined;
        return blockToEvict.sizeInBytes;
      }
    }

    return 0;
  }

  private calculateProgress(topics: Set<string>): Progress {
    const fullyLoadedFractionRanges = simplify(
      filterMap(this.blocks, (thisBlock, blockIndex) => {
        if (!thisBlock) {
          return;
        }

        for (const topic of topics) {
          if (!thisBlock.messagesByTopic[topic]) {
            return;
          }
        }

        return {
          start: blockIndex,
          end: blockIndex + 1,
        };
      }),
    );

    return {
      fullyLoadedFractionRanges: fullyLoadedFractionRanges.map((range) => ({
        // Convert block ranges into fractions.
        start: range.start / this.blocks.length,
        end: range.end / this.blocks.length,
      })),
      messageCache: {
        blocks: this.blocks.slice(),
        startTime: this.start,
      },
    };
  }

  private cacheSize(): number {
    return this.blocks.reduce((prev, block) => {
      if (!block) {
        return prev;
      }

      return prev + block.sizeInBytes;
    }, 0);
  }

  // Convert a time to a blockId. Return -1 if the time cannot be converted to a valid block id
  private timeToBlockId(stamp: Time): number {
    const startNs = toNanoSec(this.start);
    const stampNs = toNanoSec(stamp);
    const offset = stampNs - startNs;
    if (offset < 0) {
      return -1;
    }

    return Number(offset / BigInt(this.blockDurationNanos));
  }

  private blockIdToStartTime(id: number): Time {
    return add(this.start, fromNanoSec(BigInt(id) * BigInt(this.blockDurationNanos)));
  }

  // The end time of a block is the start time of the next block minus 1 nanosecond
  private blockIdToEndTime(id: number): Time {
    return add(this.start, fromNanoSec(BigInt(id + 1) * BigInt(this.blockDurationNanos) - 1n));
  }
}
