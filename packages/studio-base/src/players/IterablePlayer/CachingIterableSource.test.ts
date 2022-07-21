// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@foxglove/studio";

import { CachingIterableSource } from "./CachingIterableSource";
import {
  GetBackfillMessagesArgs,
  IIterableSource,
  Initalization,
  MessageIteratorArgs,
  IteratorResult,
} from "./IIterableSource";

class TestSource implements IIterableSource {
  async initialize(): Promise<Initalization> {
    return {
      start: { sec: 0, nsec: 0 },
      end: { sec: 10, nsec: 0 },
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

describe("CachingIterableSource", () => {
  it("should construct and initialize", async () => {
    const source = new TestSource();
    const bufferedSource = new CachingIterableSource(source);

    await bufferedSource.initialize();
    expect(bufferedSource.loadedRanges()).toEqual([{ start: 0, end: 0 }]);
  });

  it("should produce messages that the source produces", async () => {
    const source = new TestSource();
    const bufferedSource = new CachingIterableSource(source);

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

      expect(bufferedSource.loadedRanges()).toEqual([{ start: 0, end: 1 }]);
    }

    // because we have cached we shouldn't be calling source anymore
    source.messageIterator = function messageIterator(
      _args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      throw new Error("should not be called");
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

      expect(bufferedSource.loadedRanges()).toEqual([{ start: 0, end: 1 }]);
    }
  });

  it("should purge the cache when topics change", async () => {
    const source = new TestSource();
    const bufferedSource = new CachingIterableSource(source);

    await bufferedSource.initialize();

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
    };

    {
      const messageIterator = bufferedSource.messageIterator({
        topics: ["a"],
      });

      for await (const _ of messageIterator) {
        // no-op
      }

      expect(bufferedSource.loadedRanges()).toEqual([{ start: 0, end: 1 }]);
    }

    {
      const messageIterator = bufferedSource.messageIterator({
        topics: [],
      });

      await messageIterator.next();
      expect(bufferedSource.loadedRanges()).toEqual([{ start: 0, end: 0 }]);
    }
  });

  it("should yield correct messages when starting a new iterator before the the cached items", async () => {
    const source = new TestSource();
    const bufferedSource = new CachingIterableSource(source);

    await bufferedSource.initialize();

    {
      source.messageIterator = async function* messageIterator(
        _args: MessageIteratorArgs,
      ): AsyncIterableIterator<Readonly<IteratorResult>> {
        yield {
          msgEvent: {
            topic: "a",
            receiveTime: { sec: 5, nsec: 0 },
            message: undefined,
            sizeInBytes: 0,
          },
          problem: undefined,
          connectionId: undefined,
        };
      };

      const messageIterator = bufferedSource.messageIterator({
        topics: ["a"],
        start: { sec: 5, nsec: 0 },
      });

      // Read one message
      {
        const iterResult = await messageIterator.next();
        expect(iterResult).toEqual({
          done: false,
          value: {
            problem: undefined,
            connectionId: undefined,
            msgEvent: {
              receiveTime: { sec: 5, nsec: 0 },
              message: undefined,
              sizeInBytes: 0,
              topic: "a",
            },
          },
        });
      }

      {
        const iterResult = await messageIterator.next();
        expect(iterResult).toEqual({
          done: true,
        });
      }

      expect(bufferedSource.loadedRanges()).toEqual([{ start: 0.5, end: 1 }]);
    }

    // A new message iterator at the start time should emit the new message
    {
      source.messageIterator = async function* messageIterator(
        _args: MessageIteratorArgs,
      ): AsyncIterableIterator<Readonly<IteratorResult>> {
        yield {
          msgEvent: {
            topic: "a",
            receiveTime: { sec: 0, nsec: 0 },
            message: undefined,
            sizeInBytes: 0,
          },
          problem: undefined,
          connectionId: undefined,
        };
      };

      const messageIterator = bufferedSource.messageIterator({
        topics: ["a"],
        start: { sec: 0, nsec: 0 },
      });

      // Read one message
      {
        const iterResult = await messageIterator.next();
        expect(iterResult).toEqual({
          done: false,
          value: {
            problem: undefined,
            connectionId: undefined,
            msgEvent: {
              receiveTime: { sec: 0, nsec: 0 },
              message: undefined,
              sizeInBytes: 0,
              topic: "a",
            },
          },
        });
      }

      {
        const iterResult = await messageIterator.next();
        expect(iterResult).toEqual({
          done: false,
          value: {
            problem: undefined,
            connectionId: undefined,
            msgEvent: {
              receiveTime: { sec: 5, nsec: 0 },
              message: undefined,
              sizeInBytes: 0,
              topic: "a",
            },
          },
        });
      }

      {
        const iterResult = await messageIterator.next();
        expect(iterResult).toEqual({
          done: true,
        });
      }

      expect(bufferedSource.loadedRanges()).toEqual([
        { start: 0, end: 0.4999999999 },
        { start: 0.5, end: 1 },
      ]);
    }
  });

  it("should purge blocks when filled", async () => {
    const source = new TestSource();
    const bufferedSource = new CachingIterableSource(source, {
      maxBlockSize: 100,
      maxTotalSize: 300,
    });

    await bufferedSource.initialize();

    source.messageIterator = async function* messageIterator(
      _args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      yield {
        msgEvent: {
          topic: "a",
          receiveTime: { sec: 0, nsec: 0 },
          message: undefined,
          sizeInBytes: 101,
        },
        problem: undefined,
        connectionId: undefined,
      };

      yield {
        msgEvent: {
          topic: "a",
          receiveTime: { sec: 5, nsec: 1 },
          message: undefined,
          sizeInBytes: 101,
        },
        problem: undefined,
        connectionId: undefined,
      };

      yield {
        msgEvent: {
          topic: "a",
          receiveTime: { sec: 10, nsec: 0 },
          message: undefined,
          sizeInBytes: 101,
        },
        problem: undefined,
        connectionId: undefined,
      };
    };

    const messageIterator = bufferedSource.messageIterator({
      topics: ["a"],
    });

    await messageIterator.next();

    // Nothing has been actually saved into the cache but we did emit the first item
    expect(bufferedSource.loadedRanges()).toEqual([{ start: 0, end: 0 }]);

    await messageIterator.next();
    // We've read another message which let us setup a block for all the time we've read till now
    expect(bufferedSource.loadedRanges()).toEqual([{ start: 0, end: 0.5 }]);

    await messageIterator.next();
    expect(bufferedSource.loadedRanges()).toEqual([{ start: 0.5000000001, end: 0.9999999999 }]);

    await messageIterator.next();
    expect(bufferedSource.loadedRanges()).toEqual([
      { start: 0.5000000001, end: 0.9999999999 },
      { start: 1, end: 1 },
    ]);
  });

  it("should return fully cached when there is no data in the source", async () => {
    const source = new TestSource();
    const bufferedSource = new CachingIterableSource(source, {
      maxBlockSize: 100,
      maxTotalSize: 300,
    });

    await bufferedSource.initialize();

    source.messageIterator = async function* messageIterator(
      _args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      // no-op
    };

    const messageIterator = bufferedSource.messageIterator({
      topics: ["a"],
    });

    await messageIterator.next();
    expect(bufferedSource.loadedRanges()).toEqual([{ start: 0, end: 1 }]);
  });

  it("should respect end bounds when loading the cache", async () => {
    const source = new TestSource();
    const bufferedSource = new CachingIterableSource(source);

    await bufferedSource.initialize();

    source.messageIterator = async function* messageIterator(
      args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      yield {
        msgEvent: {
          topic: "a",
          receiveTime: { sec: 3, nsec: 0 },
          message: undefined,
          sizeInBytes: 0,
        },
        problem: undefined,
        connectionId: undefined,
      };

      if ((args.end?.sec ?? 100) < 6) {
        return;
      }

      yield {
        msgEvent: {
          topic: "a",
          receiveTime: { sec: 6, nsec: 0 },
          message: undefined,
          sizeInBytes: 0,
        },
        problem: undefined,
        connectionId: undefined,
      };
    };

    const messageIterator = bufferedSource.messageIterator({
      topics: ["a"],
      end: { sec: 4, nsec: 0 },
    });

    {
      const res = await messageIterator.next();
      expect(res.value).toEqual({
        msgEvent: {
          topic: "a",
          receiveTime: { sec: 3, nsec: 0 },
          message: undefined,
          sizeInBytes: 0,
        },
        problem: undefined,
        connectionId: undefined,
      });
    }

    {
      const res = await messageIterator.next();
      expect(res.done).toEqual(true);
    }
  });

  it("should respect end bounds when reading the cache", async () => {
    const source = new TestSource();
    const bufferedSource = new CachingIterableSource(source);

    await bufferedSource.initialize();

    source.messageIterator = async function* messageIterator(
      _args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      yield {
        msgEvent: {
          topic: "a",
          receiveTime: { sec: 3, nsec: 0 },
          message: undefined,
          sizeInBytes: 0,
        },
        problem: undefined,
        connectionId: undefined,
      };

      yield {
        msgEvent: {
          topic: "a",
          receiveTime: { sec: 6, nsec: 0 },
          message: undefined,
          sizeInBytes: 0,
        },
        problem: undefined,
        connectionId: undefined,
      };
    };

    {
      const messageIterator = bufferedSource.messageIterator({
        topics: ["a"],
      });

      for await (const _ of messageIterator) {
        // no-op
      }
    }

    const messageIterator = bufferedSource.messageIterator({
      topics: ["a"],
      end: { sec: 4, nsec: 0 },
    });

    {
      const res = await messageIterator.next();
      expect(res.value).toEqual({
        msgEvent: {
          topic: "a",
          receiveTime: { sec: 3, nsec: 0 },
          message: undefined,
          sizeInBytes: 0,
        },
        problem: undefined,
        connectionId: undefined,
      });
    }

    {
      const res = await messageIterator.next();
      expect(res.done).toEqual(true);
    }
  });
});
