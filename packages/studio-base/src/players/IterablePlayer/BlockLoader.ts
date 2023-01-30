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
import { IteratorCursor } from "@foxglove/studio-base/players/IterablePlayer/IteratorCursor";
import PlayerProblemManager from "@foxglove/studio-base/players/PlayerProblemManager";
import { MessageBlock, Progress } from "@foxglove/studio-base/players/types";

import { IIterableSource, MessageIteratorArgs } from "./IIterableSource";

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
  private problemManager: PlayerProblemManager;
  private stopped: boolean = false;
  private activeChangeCondvar: Condvar = new Condvar();
  private abortController: AbortController;

  public constructor(args: BlockLoaderArgs) {
    this.source = args.source;
    this.start = args.start;
    this.end = args.end;
    this.maxCacheSize = args.cacheSizeBytes;
    this.problemManager = args.problemManager;
    this.abortController = new AbortController();

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

  public setTopics(topics: Set<string>): void {
    if (isEqual(topics, this.topics)) {
      return;
    }

    this.abortController.abort();
    this.topics = topics;
    this.activeChangeCondvar.notifyAll();
    log.debug(`Preloaded topics: ${[...topics].join(", ")}`);

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

  /**
   * Remove topics that are no longer requested to be preloaded from blocks to free up space
   */
  private _removeUnusedBlockTopics(): number {
    const topics = this.topics;
    let totalBytesRemoved = 0;
    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i];
      if (block) {
        let blockBytesRemoved = 0;
        const newMessagesByTopic: Record<string, MessageEvent<unknown>[]> = {
          ...block.messagesByTopic,
        };
        const blockTopics = Object.keys(newMessagesByTopic);
        for (const topic of blockTopics) {
          // remove topics that are no longer requested to be preloaded.
          if (!topics.has(topic) && newMessagesByTopic[topic]) {
            for (const msg of newMessagesByTopic[topic]!) {
              blockBytesRemoved += msg.sizeInBytes;
            }
            delete newMessagesByTopic[topic];
          }
        }
        if (blockBytesRemoved > 0) {
          this.blocks[i] = {
            ...block,
            messagesByTopic: newMessagesByTopic,
            sizeInBytes: block.sizeInBytes - blockBytesRemoved,
          };
          totalBytesRemoved += blockBytesRemoved;
        }
      }
    }
    return totalBytesRemoved;
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
      this.abortController = new AbortController();

      const topics = this.topics;

      await this.load({ progress: args.progress });

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (this.stopped) {
        break;
      }

      // Wait for topics to possibly change.
      if (this.topics === topics) {
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

    if (this.blocks.length === 0) {
      return;
    }

    log.debug("loading blocks", { topics });
    const beginBlockId = 0;
    const lastBlockId = this.blocks.length;

    const { progress } = args;
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

      const cursorStartTime = this.blockIdToStartTime(blockId);
      const cursorEndTime = clampTime(this.blockIdToEndTime(endBlockId), this.start, this.end);

      const iteratorArgs: MessageIteratorArgs = {
        topics: Array.from(topicsToFetch),
        start: cursorStartTime,
        end: cursorEndTime,
        consumptionType: "full",
      };

      // If the source provides a message cursor we use its message cursor, otherwise we make one
      // using the source's message iterator.
      const cursor =
        this.source.getMessageCursor?.({ ...iteratorArgs, abort: this.abortController.signal }) ??
        new IteratorCursor(this.source.messageIterator(iteratorArgs), this.abortController.signal);

      for (let currentBlockId = blockId; currentBlockId <= endBlockId; ++currentBlockId) {
        const untilTime = clampTime(this.blockIdToEndTime(currentBlockId), this.start, this.end);

        const results = await cursor.readUntil(untilTime);
        // No results means cursor aborted or eof
        if (!results) {
          return;
        }

        const messagesByTopic: Record<string, MessageEvent<unknown>[]> = {};

        // Set all topics to empty arrays. Since our cursor requested all the topicsToFetch we either will
        // have message on the topic or we don't have message on the topic. Either way the topic entry
        // starts as an empty array.
        for (const topic of topicsToFetch) {
          messagesByTopic[topic] = [];
        }

        // Empty result set does not require further processing and does not change the size
        if (results.length === 0) {
          const existingBlock = this.blocks[currentBlockId];
          this.blocks[currentBlockId] = {
            needTopics: new Set(),
            messagesByTopic: {
              ...existingBlock?.messagesByTopic,
              // Any new topics override the same previous topic
              ...messagesByTopic,
            },
            sizeInBytes: existingBlock?.sizeInBytes ?? 0,
          };
          continue;
        }

        let sizeInBytes = 0;
        for (const iterResult of results) {
          if (iterResult.type === "problem") {
            this.problemManager.addProblem(`connid-${iterResult.connectionId}`, iterResult.problem);
            continue;
          }

          if (iterResult.type !== "message-event") {
            continue;
          }

          const msgTopic = iterResult.msgEvent.topic;
          const arr = messagesByTopic[msgTopic];

          // Because we initialized all the topicsToFetch earlier we expect to have an array for each message
          // topic in our results. If we don't, thats a problem.
          const problemKey = `unexpected-topic-${msgTopic}`;
          if (!arr) {
            this.problemManager.addProblem(problemKey, {
              severity: "error",
              message: `Received a message on an unexpected topic: ${msgTopic}.`,
            });

            continue;
          }
          this.problemManager.removeProblem(problemKey);

          const messageSizeInBytes = iterResult.msgEvent.sizeInBytes;
          totalBlockSizeBytes += messageSizeInBytes;
          arr.push(iterResult.msgEvent);

          sizeInBytes += messageSizeInBytes;

          if (totalBlockSizeBytes < this.maxCacheSize) {
            this.problemManager.removeProblem("cache-full");
            continue;
          }
          // cache over capacity, try removing unused topics
          const removedSize = this._removeUnusedBlockTopics();
          totalBlockSizeBytes -= removedSize;
          if (totalBlockSizeBytes > this.maxCacheSize) {
            this.problemManager.addProblem("cache-full", {
              severity: "error",
              message: `Cache is full. Preloading for topics [${Array.from(topicsToFetch).join(
                ", ",
              )}] has stopped on block ${currentBlockId + 1}/${this.blocks.length}.`,
              tip: "Try reducing the number of topics that require preloading at a given time (e.g. in plots), or try to reduce the time range of the file.",
            });
            return;
          }
        }

        const existingBlock = this.blocks[currentBlockId];
        this.blocks[currentBlockId] = {
          needTopics: new Set(),
          messagesByTopic: {
            ...existingBlock?.messagesByTopic,
            // Any new topics override the same previous topic
            ...messagesByTopic,
          },
          sizeInBytes: (existingBlock?.sizeInBytes ?? 0) + sizeInBytes,
        };

        progress(this.calculateProgress(topics));
      }

      await cursor.end();
      blockId = endBlockId + 1;
    }
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

  private blockIdToStartTime(id: number): Time {
    return add(this.start, fromNanoSec(BigInt(id) * BigInt(this.blockDurationNanos)));
  }

  // The end time of a block is the start time of the next block minus 1 nanosecond
  private blockIdToEndTime(id: number): Time {
    return add(this.start, fromNanoSec(BigInt(id + 1) * BigInt(this.blockDurationNanos) - 1n));
  }
}
