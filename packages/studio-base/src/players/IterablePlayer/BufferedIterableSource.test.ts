// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@foxglove/studio";

import { BufferedIterableSource } from "./BufferedIterableSource";
import {
  GetBackfillMessagesArgs,
  IIterableSource,
  Initalization,
  MessageIteratorArgs,
  IteratorResult,
} from "./IIterableSource";

function waiter(count: number) {
  let resolver: () => void;

  let notificationSignal = new Promise<void>((resolve) => {
    resolver = resolve;
  });

  return {
    wait: async () => {
      for (let i = 0; i < count; ++i) {
        await notificationSignal;
        notificationSignal = new Promise<void>((resolve) => {
          resolver = resolve;
        });
      }
    },
    notify: () => {
      resolver();
    },
  };
}

class TestSource implements IIterableSource {
  async initialize(): Promise<Initalization> {
    return {
      start: { sec: 0, nsec: 0 },
      end: { sec: 1, nsec: 0 },
      topics: [],
      topicStats: new Map(),
      profile: undefined,
      problems: [],
      datatypes: new Map(),
      publishersByTopic: new Map(),
    };
  }

  async *messageIterator(
    _args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {}

  async getBackfillMessages(_args: GetBackfillMessagesArgs): Promise<MessageEvent<unknown>[]> {
    return [];
  }
}

describe("BufferedIterableSource", () => {
  it("should construct and initialize", async () => {
    const source = new TestSource();
    const bufferedSource = new BufferedIterableSource(source);

    await bufferedSource.initialize();
    expect(bufferedSource.loadedRanges()).toEqual([{ start: 0, end: 0 }]);
  });

  it("should produce messages that the source produces", async () => {
    const source = new TestSource();
    const bufferedSource = new BufferedIterableSource(source);

    await bufferedSource.initialize();

    source.messageIterator = async function* messageIterator(
      _args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      for (let i = 0; i < 8; ++i) {
        yield {
          msgEvent: {
            topic: "a",
            receiveTime: { sec: 0, nsec: i * 1e8 },
            message: undefined,
            sizeInBytes: 0,
          },
          problem: undefined,
          connectionId: undefined,
        };
      }
    };

    const messageIterator = bufferedSource.messageIterator({
      topics: ["a"],
    });

    // confirm messages are what we expect
    for (let i = 0; i < 8; ++i) {
      const iterResult = messageIterator.next();
      await expect(iterResult).resolves.toEqual({
        done: false,
        value: {
          problem: undefined,
          connectionId: undefined,
          msgEvent: {
            receiveTime: { sec: 0, nsec: i * 1e8 },
            message: undefined,
            sizeInBytes: 0,
            topic: "a",
          },
        },
      });
    }

    // The message iterator should be done since we have no more data to read from the source
    const iterResult = messageIterator.next();
    await expect(iterResult).resolves.toEqual({
      done: true,
    });

    expect(bufferedSource.loadedRanges()).toEqual([{ start: 0, end: 1 }]);
  });

  it("should produce messages after buffering is complete", async () => {
    const source = new TestSource();
    const bufferedSource = new BufferedIterableSource(source);

    await bufferedSource.initialize();

    let count = 0;
    const signal = waiter(1);

    source.messageIterator = async function* messageIterator(
      _args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      count += 1;

      for (let i = 0; i < 8; ++i) {
        yield {
          msgEvent: {
            topic: "a",
            receiveTime: { sec: 0, nsec: i * 1e8 },
            message: undefined,
            sizeInBytes: 0,
          },
          problem: undefined,
          connectionId: undefined,
        };
      }
      signal.notify();
    };

    {
      const messageIterator = bufferedSource.messageIterator({
        topics: ["a"],
      });

      // confirm messages are what we expect
      for (let i = 0; i < 8; ++i) {
        const iterResult = messageIterator.next();
        await expect(iterResult).resolves.toEqual({
          done: false,
          value: {
            problem: undefined,
            connectionId: undefined,
            msgEvent: {
              receiveTime: { sec: 0, nsec: i * 1e8 },
              message: undefined,
              sizeInBytes: 0,
              topic: "a",
            },
          },
        });
      }

      // The message iterator should be done since we have no more data to read from the source
      const iterResult = messageIterator.next();
      await expect(iterResult).resolves.toEqual({
        done: true,
      });
    }

    expect(count).toEqual(1);
  });

  it("should indicate loaded ranges are done even when last message is before end", async () => {
    const source = new TestSource();
    const bufferedSource = new BufferedIterableSource(source);

    await bufferedSource.initialize();

    const signal = waiter(1);

    source.messageIterator = async function* messageIterator(
      _args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      for (let i = 0; i < 8; ++i) {
        yield {
          msgEvent: {
            topic: "a",
            receiveTime: { sec: 0, nsec: i * 1e8 },
            message: undefined,
            sizeInBytes: 0,
          },
          problem: undefined,
          connectionId: undefined,
        };
      }
      signal.notify();
    };

    const messageIterator = bufferedSource.messageIterator({
      topics: ["a"],
    });

    await signal.wait();

    expect(bufferedSource.loadedRanges()).toEqual([{ start: 0, end: 1 }]);

    // confirm messages are what we expect
    for (let i = 0; i < 8; ++i) {
      const iterResult = messageIterator.next();
      await expect(iterResult).resolves.toEqual({
        done: false,
        value: {
          problem: undefined,
          connectionId: undefined,
          msgEvent: {
            receiveTime: { sec: 0, nsec: i * 1e8 },
            message: undefined,
            sizeInBytes: 0,
            topic: "a",
          },
        },
      });
    }

    // The message iterator should be done since we have no more data to read from the source
    const iterResult = messageIterator.next();
    await expect(iterResult).resolves.toEqual({
      done: true,
    });
  });

  it("should indicate loading ranges when partially buffered", async () => {
    const source = new TestSource();
    const bufferedSource = new BufferedIterableSource(source);

    await bufferedSource.initialize();

    const partialBuffer = waiter(6);
    const doneYield = waiter(1);

    source.messageIterator = async function* messageIterator(
      _args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      for (let i = 0; i < 8; ++i) {
        yield {
          msgEvent: {
            topic: "a",
            receiveTime: { sec: 0, nsec: i * 1e8 },
            message: undefined,
            sizeInBytes: 0,
          },
          problem: undefined,
          connectionId: undefined,
        };
        partialBuffer.notify();
      }
      doneYield.notify();
    };

    bufferedSource.messageIterator({
      topics: ["a"],
    });

    await partialBuffer.wait();

    expect(bufferedSource.loadedRanges()).toEqual([{ start: 0, end: 0.499999999 }]);

    // When the underlying source has finished loading, the _end_ is reached even if the last message is not at the end time
    await doneYield.wait();
    expect(bufferedSource.loadedRanges()).toEqual([{ start: 0, end: 1 }]);
  });

  it("should yield correct messages when starting a new iterator before the the cached items", async () => {
    const source = new TestSource();
    const bufferedSource = new BufferedIterableSource(source);

    await bufferedSource.initialize();

    {
      const doneYield = waiter(1);

      source.messageIterator = async function* messageIterator(
        _args: MessageIteratorArgs,
      ): AsyncIterableIterator<Readonly<IteratorResult>> {
        yield {
          msgEvent: {
            topic: "a",
            receiveTime: { sec: 0, nsec: 500000000 },
            message: undefined,
            sizeInBytes: 0,
          },
          problem: undefined,
          connectionId: undefined,
        };
        doneYield.notify();
      };

      const messageIterator = bufferedSource.messageIterator({
        topics: ["a"],
        start: { sec: 0, nsec: 500000000 },
      });

      await doneYield.wait();
      expect(bufferedSource.loadedRanges()).toEqual([{ start: 0.5, end: 1 }]);
      await messageIterator.return?.();
      await bufferedSource.stopProducer();
    }

    // A new message iterator at the start time should properly a new message then the other messages
    {
      const doneYield = waiter(1);

      source.messageIterator = async function* messageIterator(
        _args: MessageIteratorArgs,
      ): AsyncIterableIterator<Readonly<IteratorResult>> {
        yield {
          msgEvent: {
            topic: "a",
            receiveTime: { sec: 0, nsec: 1 },
            message: undefined,
            sizeInBytes: 0,
          },
          problem: undefined,
          connectionId: undefined,
        };
        doneYield.notify();
      };

      const messageIterator = bufferedSource.messageIterator({
        topics: ["a"],
        start: { sec: 0, nsec: 0 },
      });

      await doneYield.wait();

      expect(bufferedSource.loadedRanges()).toEqual([
        { start: 0, end: 0.499999999 },
        { start: 0.5, end: 1 },
      ]);

      {
        {
          const iterResult = messageIterator.next();
          await expect(iterResult).resolves.toEqual({
            done: false,
            value: {
              problem: undefined,
              connectionId: undefined,
              msgEvent: {
                receiveTime: { sec: 0, nsec: 1 },
                message: undefined,
                sizeInBytes: 0,
                topic: "a",
              },
            },
          });
        }

        {
          const iterResult = messageIterator.next();
          await expect(iterResult).resolves.toEqual({
            done: false,
            value: {
              problem: undefined,
              connectionId: undefined,
              msgEvent: {
                receiveTime: { sec: 0, nsec: 500000000 },
                message: undefined,
                sizeInBytes: 0,
                topic: "a",
              },
            },
          });
        }
      }

      {
        const iterResult = messageIterator.next();
        await expect(iterResult).resolves.toEqual({
          done: true,
        });
      }
    }
  });
});
