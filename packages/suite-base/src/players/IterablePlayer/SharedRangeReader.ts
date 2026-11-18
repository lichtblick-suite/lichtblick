// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { compare, Time } from "@lichtblick/rostime";

import { IDeserializedIterableSource, IteratorResult } from "./IIterableSource";

type Source = Pick<IDeserializedIterableSource, "messageIterator">;
type Result = Readonly<IteratorResult>;

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
 */
export class SharedRangeReader {
  readonly #source: Source;
  readonly #options: SharedRangeReaderOptions;
  #collecting: ReadGroup | undefined;

  public constructor(source: Source, options: Partial<SharedRangeReaderOptions> = {}) {
    this.#source = source;
    this.#options = { ...DEFAULT_OPTIONS, ...options };
  }

  public iterator(topic: string): AsyncIterableIterator<Result> {
    if (this.#collecting == undefined) {
      const group = new ReadGroup(this.#source, this.#options, () => {
        if (this.#collecting === group) {
          this.#collecting = undefined;
        }
      });
      this.#collecting = group;
    }
    return this.#collecting.addReader(topic);
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

  public addReader(topic: string): AsyncIterableIterator<Result> {
    const reader = new TopicReader(topic, () => {
      this.#removeReader(reader);
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
    return reader.iterator;
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
      void this.#sourceIterator?.return?.();
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
  #queue: Result[] = [];
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
        this.#close();
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
        this.#head++;
        if (value.type === "message-event") {
          this.#queuedBytes -= value.msgEvent.sizeInBytes;
          this.#recordHandedOut(value.msgEvent.receiveTime);
        }
        if (this.#head === this.#queue.length) {
          this.#queue = [];
          this.#head = 0;
        }
        return { done: false, value };
      }
      if (this.#ownIterator != undefined) {
        return await this.#nextOwn(this.#ownIterator);
      }
      if (this.#error != undefined) {
        this.#close();
        throw this.#error.value;
      }
      if (this.#finished) {
        this.#close();
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
        this.#close();
        throw error;
      }
      if (this.#closed) {
        return { done: true, value: undefined };
      }
      if (next.done === true) {
        this.#close();
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

  #close(): void {
    if (this.#closed) {
      return;
    }
    this.#closed = true;
    this.#queue = [];
    this.#head = 0;
    this.#queuedBytes = 0;
    void this.#ownIterator?.return?.();
    this.#onClose();
    this.#wakeUp();
  }
}
