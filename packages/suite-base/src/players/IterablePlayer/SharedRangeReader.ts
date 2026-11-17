// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { IDeserializedIterableSource, IteratorResult } from "./IIterableSource";

type Source = Pick<IDeserializedIterableSource, "messageIterator">;
type Result = Readonly<IteratorResult>;

export type SharedRangeReaderOptions = {
  /** Start reading once no new topic was requested for this long. */
  quietMs: number;
  /** Start reading at the latest this long after the first request of a group. */
  maxWaitMs: number;
  /** Pause reading while any reader has this many results waiting. */
  maxQueuedResults: number;
};

// Measured on a 3D + 2 Plot + State Transitions layout: Plot requested its topics at +0 ms and
// State Transitions at +41-43 ms, so the quiet time must exceed that to share one pass.
const DEFAULT_OPTIONS: SharedRangeReaderOptions = {
  quietMs: 60,
  maxWaitMs: 250,
  maxQueuedResults: 10_000,
};

/**
 * Serves full-range reads of single topics from one shared source iterator per group of requests.
 *
 * Reading one topic of a file still decompresses every chunk that contains it, and in recordings
 * with many topics that is every chunk. Requests that arrive close together are therefore grouped
 * and read in a single pass, and each reader gets only the results for its own topic.
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
  #resumeReading: (() => void) | undefined;

  public constructor(source: Source, options: SharedRangeReaderOptions, onStart: () => void) {
    this.#source = source;
    this.#options = options;
    this.#onStart = onStart;
    this.#maxWaitTimer = setTimeout(() => {
      this.#start();
    }, options.maxWaitMs);
  }

  public addReader(topic: string): AsyncIterableIterator<Result> {
    const reader = new TopicReader(
      topic,
      () => {
        this.#resumeReading?.();
      },
      () => {
        this.#removeReader(reader);
      },
    );
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

  #removeReader(reader: TopicReader): void {
    const readers = this.#readersByTopic.get(reader.topic);
    if (readers?.delete(reader) !== true) {
      return;
    }
    this.#readerCount--;
    if (readers.size === 0) {
      this.#readersByTopic.delete(reader.topic);
    }
    if (this.#readerCount === 0 && this.#started) {
      void this.#sourceIterator?.return?.();
    }
    // A closed reader may have been the one that paused reading.
    this.#resumeReading?.();
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
        if (this.#isAnyReaderFull()) {
          await new Promise<void>((resolve) => {
            this.#resumeReading = resolve;
          });
          this.#resumeReading = undefined;
          continue;
        }
        const next = await sourceIterator.next();
        if (next.done === true) {
          break;
        }
        this.#deliver(next.value);
      }
      this.#forEachReader((reader) => {
        reader.finish();
      });
    } catch (error: unknown) {
      this.#forEachReader((reader) => {
        reader.fail(error);
      });
    }
  }

  #deliver(result: Result): void {
    if (result.type === "message-event") {
      for (const reader of this.#readersByTopic.get(result.msgEvent.topic) ?? []) {
        reader.push(result);
      }
      return;
    }
    // Alerts and stamps aren't tied to one topic, so every reader gets them as before.
    this.#forEachReader((reader) => {
      reader.push(result);
    });
  }

  #isAnyReaderFull(): boolean {
    for (const readers of this.#readersByTopic.values()) {
      for (const reader of readers) {
        if (reader.queuedCount() >= this.#options.maxQueuedResults) {
          return true;
        }
      }
    }
    return false;
  }

  #forEachReader(fn: (reader: TopicReader) => void): void {
    for (const readers of [...this.#readersByTopic.values()]) {
      for (const reader of [...readers]) {
        fn(reader);
      }
    }
  }
}

class TopicReader {
  public readonly topic: string;
  public readonly iterator: AsyncIterableIterator<Result>;
  readonly #onPull: () => void;
  readonly #onClose: () => void;
  #queue: Result[] = [];
  #head = 0;
  #finished = false;
  #error: { value: unknown } | undefined;
  #closed = false;
  #wake: (() => void) | undefined;

  public constructor(topic: string, onPull: () => void, onClose: () => void) {
    this.topic = topic;
    this.#onPull = onPull;
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

  public push(result: Result): void {
    if (this.#closed) {
      return;
    }
    this.#queue.push(result);
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

  async #next(): Promise<IteratorReturnResult<undefined> | IteratorYieldResult<Result>> {
    for (;;) {
      if (this.#closed) {
        return { done: true, value: undefined };
      }
      if (this.#head < this.#queue.length) {
        const value = this.#queue[this.#head]!;
        this.#head++;
        if (this.#head === this.#queue.length) {
          this.#queue = [];
          this.#head = 0;
        }
        this.#onPull();
        return { done: false, value };
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
    this.#onClose();
    this.#wakeUp();
  }
}
