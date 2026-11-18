// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import Log from "@lichtblick/log";
import { compare, Time } from "@lichtblick/rostime";

import { IDeserializedIterableSource, IteratorResult } from "./IIterableSource";

const log = Log.getLogger(__filename);

type Source = Pick<IDeserializedIterableSource, "messageIterator">;
type Result = Readonly<IteratorResult>;

// A failed cleanup must not stop the caller's own cleanup, hand-over or wake-up.
function stopSourceIterator(iterator: AsyncIterator<Result> | undefined): void {
  try {
    iterator?.return?.().catch((error: unknown) => {
      log.debug("Error closing source iterator:", error);
    });
  } catch (error: unknown) {
    log.debug("Error closing source iterator:", error);
  }
}

export type SharedRangeReaderOptions = {
  /** Start reading once no new topic was requested for this long. */
  quietMs: number;
  /** Start reading at the latest this long after the first request of a group. */
  maxWaitMs: number;
  /** A reader with this many results waiting leaves the group and reads on its own. */
  maxQueuedResults: number;
  /** A reader with this many message bytes waiting leaves the group and reads on its own. */
  maxQueuedBytes: number;
};

// Measured on a 3D + 2 Plot + State Transitions layout: Plot requested its topics at +0 ms and
// State Transitions at +41-43 ms, so the quiet time must exceed that to share one pass.
const DEFAULT_OPTIONS: SharedRangeReaderOptions = {
  quietMs: 60,
  maxWaitMs: 250,
  maxQueuedResults: 10_000,
  maxQueuedBytes: 64 * 1024 * 1024,
};

// A queue that never fully drains is compacted once this many consumed slots pile up.
const COMPACT_AFTER = 1024;

/**
 * Serves full-range reads of single topics from one shared source iterator per group of requests.
 *
 * Reading one topic of a file still decompresses every chunk that contains it, and in recordings
 * with many topics that is every chunk. Requests that arrive close together are therefore grouped
 * and read in a single pass, and each reader gets only the results for its own topic.
 *
 * The shared pass never waits for a single reader: a reader that falls too far behind (or is never
 * read) leaves the group, drops its queue and continues after the last message it handed out with
 * its own source iterator, like an unshared read would.
 *
 * A group holds at most one reader per topic, so readers never receive the same message objects.
 * Converters and extensions may modify the messages they get, and unshared reads allowed that.
 */
export class SharedRangeReader {
  readonly #source: Source;
  readonly #options: SharedRangeReaderOptions;
  #collecting: ReadGroup[] = [];
  readonly #readers = new Set<TopicReader>();
  #closed = false;

  public constructor(source: Source, options: Partial<SharedRangeReaderOptions> = {}) {
    this.#source = source;
    this.#options = { ...DEFAULT_OPTIONS, ...options };
  }

  public iterator(topic: string): AsyncIterableIterator<Result> {
    if (this.#closed) {
      return (async function* () {})();
    }
    let group = this.#collecting.find((candidate) => !candidate.hasTopic(topic));
    if (group == undefined) {
      const newGroup = new ReadGroup(this.#source, this.#options, () => {
        this.#collecting = this.#collecting.filter((candidate) => candidate !== newGroup);
      });
      this.#collecting.push(newGroup);
      group = newGroup;
    }
    const reader = group.addReader(topic, () => {
      this.#readers.delete(reader);
    });
    this.#readers.add(reader);
    return reader.iterator;
  }

  /** Stops every read. Later requests end right away without reading the source. */
  public close(): void {
    this.#closed = true;
    for (const group of this.#collecting) {
      group.cancelStart();
    }
    this.#collecting = [];
    for (const reader of [...this.#readers]) {
      reader.close();
    }
  }
}

class ReadGroup {
  readonly #source: Source;
  readonly #options: SharedRangeReaderOptions;
  readonly #onStart: () => void;
  readonly #readersByTopic = new Map<string, Set<TopicReader>>();
  #readerCount = 0;
  #quietTimer: ReturnType<typeof setTimeout> | undefined;
  #maxWaitTimer: ReturnType<typeof setTimeout> | undefined;
  #started = false;
  #sourceIterator: AsyncIterator<Result> | undefined;

  public constructor(source: Source, options: SharedRangeReaderOptions, onStart: () => void) {
    this.#source = source;
    this.#options = options;
    this.#onStart = onStart;
    this.#maxWaitTimer = setTimeout(() => {
      this.#start();
    }, options.maxWaitMs);
  }

  public hasTopic(topic: string): boolean {
    return this.#readersByTopic.has(topic);
  }

  /** Prevents the shared pass from starting. */
  public cancelStart(): void {
    this.#started = true;
    clearTimeout(this.#quietTimer);
    clearTimeout(this.#maxWaitTimer);
  }

  public addReader(topic: string, onClose: () => void): TopicReader {
    const reader = new TopicReader(topic, () => {
      this.#removeReader(reader);
      onClose();
    });
    let readers = this.#readersByTopic.get(topic);
    if (readers == undefined) {
      readers = new Set();
      this.#readersByTopic.set(topic, readers);
    }
    readers.add(reader);
    this.#readerCount++;

    clearTimeout(this.#quietTimer);
    this.#quietTimer = setTimeout(() => {
      this.#start();
    }, this.#options.quietMs);
    return reader;
  }

  /** Removes the reader from the group; returns false if it wasn't a member. */
  #removeReader(reader: TopicReader): boolean {
    const readers = this.#readersByTopic.get(reader.topic);
    if (readers?.delete(reader) !== true) {
      return false;
    }
    this.#readerCount--;
    if (readers.size === 0) {
      this.#readersByTopic.delete(reader.topic);
    }
    if (this.#readerCount === 0 && this.#started) {
      stopSourceIterator(this.#sourceIterator);
    }
    return true;
  }

  #start(): void {
    if (this.#started) {
      return;
    }
    this.#started = true;
    clearTimeout(this.#quietTimer);
    clearTimeout(this.#maxWaitTimer);
    this.#onStart();
    if (this.#readerCount === 0) {
      return;
    }
    const topics = new Map([...this.#readersByTopic.keys()].map((topic) => [topic, { topic }]));
    this.#sourceIterator = this.#source.messageIterator({ topics, consumptionType: "full" });
    void this.#read(this.#sourceIterator);
  }

  async #read(sourceIterator: AsyncIterator<Result>): Promise<void> {
    try {
      while (this.#readerCount > 0) {
        const next = await sourceIterator.next();
        if (next.done === true) {
          break;
        }
        this.#deliver(next.value);
      }
      for (const reader of this.#readers()) {
        reader.finish();
      }
    } catch (error: unknown) {
      for (const reader of this.#readers()) {
        reader.fail(error);
      }
    }
  }

  #deliver(result: Result): void {
    // Alerts and stamps aren't tied to one topic, so every reader gets them as before.
    const receivers =
      result.type === "message-event"
        ? [...(this.#readersByTopic.get(result.msgEvent.topic) ?? [])]
        : this.#readers();
    for (const reader of receivers) {
      reader.push(result);
      if (
        reader.queuedCount() >= this.#options.maxQueuedResults ||
        reader.queuedBytes() >= this.#options.maxQueuedBytes
      ) {
        this.#detach(reader);
      }
    }
  }

  #detach(reader: TopicReader): void {
    if (this.#removeReader(reader)) {
      reader.continueAlone(this.#source);
    }
  }

  #readers(): TopicReader[] {
    const all: TopicReader[] = [];
    for (const readers of this.#readersByTopic.values()) {
      all.push(...readers);
    }
    return all;
  }
}

class TopicReader {
  public readonly topic: string;
  public readonly iterator: AsyncIterableIterator<Result>;
  readonly #onClose: () => void;
  // Consumed slots are cleared so handed-out messages can be garbage collected.
  #queue: (Result | undefined)[] = [];
  #head = 0;
  #queuedBytes = 0;
  #finished = false;
  #error: { value: unknown } | undefined;
  #closed = false;
  #wake: (() => void) | undefined;
  // Receive time of the last message handed out, and how many handed-out messages share it.
  #lastTime: Time | undefined;
  #countAtLastTime = 0;
  // Set once the reader has left its group and reads on its own.
  #ownIterator: AsyncIterator<Result> | undefined;
  #skipTime: Time | undefined;
  #skipCount = 0;

  public constructor(topic: string, onClose: () => void) {
    this.topic = topic;
    this.#onClose = onClose;
    this.iterator = {
      next: async () => await this.#next(),
      return: async () => {
        this.close();
        return { done: true, value: undefined };
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  }

  public queuedCount(): number {
    return this.#queue.length - this.#head;
  }

  public queuedBytes(): number {
    return this.#queuedBytes;
  }

  public push(result: Result): void {
    if (this.#closed) {
      return;
    }
    this.#queue.push(result);
    if (result.type === "message-event") {
      this.#queuedBytes += result.msgEvent.sizeInBytes;
    }
    this.#wakeUp();
  }

  public finish(): void {
    this.#finished = true;
    this.#wakeUp();
  }

  public fail(error: unknown): void {
    this.#error = { value: error };
    this.#wakeUp();
  }

  /**
   * Drops the queue and continues after the last handed-out message with a separate source
   * iterator, so a reader that isn't reading holds no messages. Messages that share the last
   * handed-out receive time are re-read from the source and skipped.
   */
  public continueAlone(source: Source): void {
    if (this.#closed) {
      return;
    }
    this.#queue = [];
    this.#head = 0;
    this.#queuedBytes = 0;
    this.#ownIterator = source.messageIterator({
      topics: new Map([[this.topic, { topic: this.topic }]]),
      consumptionType: "full",
      start: this.#lastTime,
    });
    this.#skipTime = this.#lastTime;
    this.#skipCount = this.#lastTime != undefined ? this.#countAtLastTime : 0;
    this.#wakeUp();
  }

  async #next(): Promise<IteratorReturnResult<undefined> | IteratorYieldResult<Result>> {
    for (;;) {
      if (this.#closed) {
        return { done: true, value: undefined };
      }
      if (this.#head < this.#queue.length) {
        const value = this.#queue[this.#head]!;
        this.#queue[this.#head] = undefined;
        this.#head++;
        if (value.type === "message-event") {
          this.#queuedBytes -= value.msgEvent.sizeInBytes;
          this.#recordHandedOut(value.msgEvent.receiveTime);
        }
        if (this.#head === this.#queue.length) {
          this.#queue = [];
          this.#head = 0;
        } else if (this.#head >= COMPACT_AFTER && this.#head * 2 >= this.#queue.length) {
          this.#queue = this.#queue.slice(this.#head);
          this.#head = 0;
        }
        return { done: false, value };
      }
      if (this.#ownIterator != undefined) {
        return await this.#nextOwn(this.#ownIterator);
      }
      if (this.#error != undefined) {
        this.close();
        throw this.#error.value;
      }
      if (this.#finished) {
        this.close();
        return { done: true, value: undefined };
      }
      await new Promise<void>((resolve) => {
        this.#wake = resolve;
      });
    }
  }

  async #nextOwn(
    ownIterator: AsyncIterator<Result>,
  ): Promise<IteratorReturnResult<undefined> | IteratorYieldResult<Result>> {
    for (;;) {
      let next: Awaited<ReturnType<AsyncIterator<Result>["next"]>>;
      try {
        next = await ownIterator.next();
      } catch (error: unknown) {
        this.close();
        throw error;
      }
      if (this.#closed) {
        return { done: true, value: undefined };
      }
      if (next.done === true) {
        this.close();
        return { done: true, value: undefined };
      }
      const value = next.value;
      if (this.#skipCount > 0 && value.type === "message-event") {
        if (compare(value.msgEvent.receiveTime, this.#skipTime!) === 0) {
          this.#skipCount--;
          continue;
        }
        this.#skipCount = 0;
      }
      return { done: false, value };
    }
  }

  #recordHandedOut(time: Time): void {
    if (this.#lastTime != undefined && compare(time, this.#lastTime) === 0) {
      this.#countAtLastTime++;
    } else {
      this.#lastTime = time;
      this.#countAtLastTime = 1;
    }
  }

  #wakeUp(): void {
    const wake = this.#wake;
    this.#wake = undefined;
    wake?.();
  }

  public close(): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#queue = [];
    this.#head = 0;
    this.#queuedBytes = 0;
    stopSourceIterator(this.#ownIterator);
    this.#onClose();
    this.#wakeUp();
  }
}
