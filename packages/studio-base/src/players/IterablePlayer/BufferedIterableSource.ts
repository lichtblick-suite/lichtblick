// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { signal, Signal } from "@foxglove/den/async";
import Log from "@foxglove/log";
import { add as addTime, compare } from "@foxglove/rostime";
import { Time, MessageEvent } from "@foxglove/studio";
import { Range } from "@foxglove/studio-base/util/ranges";

import { CachingIterableSource } from "./CachingIterableSource";
import {
  GetBackfillMessagesArgs,
  IIterableSource,
  Initalization,
  IteratorResult,
  MessageIteratorArgs,
} from "./IIterableSource";

const log = Log.getLogger(__filename);

/**
 * BufferedIterableSource proxies access to IIterableSource. It buffers the messageIterator by
 * reading ahead in the underlying source.
 *
 * The architecture of BufferedIterableSource follows a producer-consumer model. The messageIterator
 * is the consumer and reads messages from cache while the startProducer method produces messages by
 * reading from the underlying source and populating the cache.
 */
class BufferedIterableSource implements IIterableSource {
  private source: CachingIterableSource;

  private readDone = false;
  private aborted = false;

  // The producer uses this signal to notify a waiting consumer there is data to consume.
  private readSignal?: Signal<void>;

  // The consumer uses this signal to notify a waiting producer that something has been consumed.
  private writeSignal?: Signal<void>;

  // The producer loads results into the cache and the consumer reads from the cache.
  private cache: IteratorResult[] = [];

  // Keep caching more data until the cache has reached this time. As the cache is read, this time moves forward
  // to let the loading "process" know it should fetch more data
  private readUntil: Time = { sec: 0, nsec: 0 };

  // The promise for the current producer. The message generator starts a producer and awaits the
  // producer before exiting.
  private producer?: Promise<void>;

  private initResult?: Initalization;

  constructor(source: IIterableSource) {
    this.source = new CachingIterableSource(source);
  }

  async initialize(): Promise<Initalization> {
    this.initResult = await this.source.initialize();
    return this.initResult;
  }

  private async startProducer(args: MessageIteratorArgs): Promise<void> {
    if (args.topics.length === 0) {
      this.readDone = true;
      return;
    }

    log.debug("Starting producer");

    // Clear the cache and start producing into an empty array, the consumer removes elements from
    // the start of the array.
    this.cache.length = 0;

    const sourceIterator = this.source.messageIterator({
      topics: args.topics,
      start: args.start,
      end: args.end,
    });

    try {
      for await (const result of sourceIterator) {
        if (this.aborted) {
          break;
        }

        const lastResult = this.cache[this.cache.length - 1];
        const msgEvent = lastResult?.msgEvent;

        // If the last message we have has a receive time after readUntil, then there's no reading for us to do
        // We wait until the readUntil moves forward.
        if (msgEvent && compare(msgEvent.receiveTime, this.readUntil) >= 0) {
          this.writeSignal = signal();
          await this.writeSignal;
          this.writeSignal = undefined;

          continue;
        }

        this.cache.push(result);

        // Indicate to the consumer that it can try reading again
        this.readSignal?.resolve();
      }
    } finally {
      await sourceIterator.return?.();
      // Indicate to the consumer that it can try reading again
      this.readSignal?.resolve();
      this.readDone = true;
    }

    log.debug("producer done");
  }

  async stopProducer(): Promise<void> {
    this.aborted = true;
    this.writeSignal?.resolve();
    await this.producer;
    this.producer = undefined;
  }

  loadedRanges(): Range[] {
    return this.source.loadedRanges();
  }

  messageIterator(args: MessageIteratorArgs): AsyncIterableIterator<Readonly<IteratorResult>> {
    if (!this.initResult) {
      throw new Error("Invariant: uninitialized");
    }

    if (this.producer) {
      throw new Error("Invariant: BufferedIterableSource allows only one messageIterator");
    }

    const start = args.start ?? this.initResult.start;

    const readAheadTime = { sec: 10, nsec: 0 };

    // Setup the initial cacheUntilTime to start buffing data
    this.readUntil = addTime(start, readAheadTime);

    this.aborted = false;
    this.readDone = false;

    // Create and start the producer when the messageIterator function is called.
    this.producer = this.startProducer(args);

    // Rather than messageIterator itself being a generator, we return a generator function. This is
    // so the setup code above will run when the messageIterator is called rather than when .next()
    // is called the first time. This behavior is important because we want the producer to start
    // producing immediately.
    //
    // Alias `this` to `self` for use in the generator function because we can't make fat-arrow
    // generator functions
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return (async function* bufferedIterableGenerator() {
      try {
        if (args.topics.length === 0) {
          return;
        }

        for (;;) {
          const item = self.cache.shift();
          if (!item) {
            if (self.readDone) {
              break;
            }

            // Wait for more stuff to load
            self.readSignal = signal();
            await self.readSignal;
            self.readSignal = undefined;

            continue;
          }

          if (item.msgEvent) {
            self.readUntil = addTime(item.msgEvent.receiveTime, readAheadTime);
          }

          self.writeSignal?.resolve();

          yield item;
        }
      } finally {
        log.debug("ending buffered message iterator");
        await self.stopProducer();
      }
    })();
  }

  async getBackfillMessages(args: GetBackfillMessagesArgs): Promise<MessageEvent<unknown>[]> {
    return await this.source.getBackfillMessages(args);
  }
}

export { BufferedIterableSource };
