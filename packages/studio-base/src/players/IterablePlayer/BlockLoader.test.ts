// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { compare } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import PlayerProblemManager from "@foxglove/studio-base/players/PlayerProblemManager";

import { BlockLoader } from "./BlockLoader";
import {
  IIterableSource,
  Initalization,
  MessageIteratorArgs,
  IteratorResult,
  GetBackfillMessagesArgs,
} from "./IIterableSource";

class TestSource implements IIterableSource {
  public async initialize(): Promise<Initalization> {
    return {
      start: { sec: 0, nsec: 0 },
      end: { sec: 10, nsec: 0 },
      topics: [],
      topicStats: new Map(),
      problems: [],
      profile: undefined,
      datatypes: new Map(),
      publishersByTopic: new Map(),
    };
  }

  public async *messageIterator(
    _args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {}

  public async getBackfillMessages(
    _args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<unknown>[]> {
    return [];
  }
}

describe("BlockLoader", () => {
  it("should make an empty block loader", async () => {
    const loader = new BlockLoader({
      maxBlocks: 4,
      cacheSizeBytes: 1,
      minBlockDurationNs: 1,
      source: new TestSource(),
      start: { sec: 0, nsec: 0 },
      end: { sec: 2, nsec: 0 },
      problemManager: new PlayerProblemManager(),
    });

    await loader.startLoading({
      progress: async (progress) => {
        expect(progress).toEqual({
          fullyLoadedFractionRanges: [],
          messageCache: {
            blocks: [undefined, undefined, undefined, undefined],
            startTime: { sec: 0, nsec: 0 },
          },
        });
        await loader.stopLoading();
      },
    });

    expect.assertions(1);
  });

  it("should load the source into blocks", async () => {
    const source = new TestSource();

    const loader = new BlockLoader({
      maxBlocks: 5,
      cacheSizeBytes: 5,
      minBlockDurationNs: 1,
      source,
      start: { sec: 0, nsec: 0 },
      end: { sec: 9, nsec: 0 },
      problemManager: new PlayerProblemManager(),
    });

    const msgEvents: MessageEvent<unknown>[] = [];
    for (let i = 0; i < 10; i += 3) {
      msgEvents.push({
        topic: "a",
        receiveTime: { sec: i, nsec: 0 },
        message: undefined,
        sizeInBytes: 1,
        schemaName: "foo",
      });
    }

    source.messageIterator = async function* messageIterator(
      _args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      for (let i = 0; i < msgEvents.length; ++i) {
        const msgEvent = msgEvents[i]!;
        yield {
          msgEvent,
          problem: undefined,
          connectionId: undefined,
        };
      }
    };

    loader.setTopics(new Set("a"));
    let count = 0;
    await loader.startLoading({
      progress: async (progress) => {
        if (++count < 4) {
          return;
        }

        expect(progress).toEqual({
          fullyLoadedFractionRanges: [
            {
              start: 0,
              end: 1,
            },
          ],
          messageCache: {
            blocks: [
              {
                messagesByTopic: {
                  a: [msgEvents[0]],
                },
                needTopics: new Set(),
                sizeInBytes: 1,
              },
              {
                messagesByTopic: {
                  a: [msgEvents[1]],
                },
                needTopics: new Set(),
                sizeInBytes: 1,
              },
              {
                messagesByTopic: {
                  a: [],
                },
                needTopics: new Set(),
                sizeInBytes: 0,
              },
              {
                messagesByTopic: {
                  a: [msgEvents[2]],
                },
                needTopics: new Set(),
                sizeInBytes: 1,
              },
              {
                messagesByTopic: {
                  a: [msgEvents[3]],
                },
                needTopics: new Set(),
                sizeInBytes: 1,
              },
            ],
            startTime: { sec: 0, nsec: 0 },
          },
        });

        await loader.stopLoading();
      },
    });
    expect.assertions(1);
  });

  it("should load the source into blocks when starting partially through the source", async () => {
    const source = new TestSource();

    const loader = new BlockLoader({
      maxBlocks: 5,
      cacheSizeBytes: 1,
      minBlockDurationNs: 1,
      source,
      start: { sec: 0, nsec: 0 },
      end: { sec: 9, nsec: 0 },
      problemManager: new PlayerProblemManager(),
    });

    const msgEvents: MessageEvent<unknown>[] = [];
    for (let i = 0; i < 5; ++i) {
      msgEvents.push({
        topic: "a",
        receiveTime: { sec: i, nsec: 0 },
        message: undefined,
        sizeInBytes: 0,
        schemaName: "foo",
      });
    }

    source.messageIterator = async function* messageIterator(
      args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      for (let i = 0; i < msgEvents.length; ++i) {
        const msgEvent = msgEvents[i]!;
        if (args.start && compare(msgEvent.receiveTime, args.start) < 0) {
          continue;
        }
        if (args.end && compare(msgEvent.receiveTime, args.end) > 0) {
          continue;
        }

        yield {
          msgEvent,
          problem: undefined,
          connectionId: undefined,
        };
      }
    };

    loader.setTopics(new Set("a"));
    loader.setActiveTime({ sec: 3, nsec: 10 });
    let count = 0;
    await loader.startLoading({
      progress: async (progress) => {
        if (++count < 3) {
          return;
        }

        expect(progress).toEqual({
          fullyLoadedFractionRanges: [
            {
              start: 0,
              end: 1,
            },
          ],
          messageCache: {
            blocks: [
              {
                messagesByTopic: {
                  a: [msgEvents[0], msgEvents[1]],
                },
                sizeInBytes: 0,
                needTopics: new Set(),
              },
              {
                messagesByTopic: {
                  a: [msgEvents[2], msgEvents[3]],
                },
                sizeInBytes: 0,
                needTopics: new Set(),
              },
              {
                messagesByTopic: {
                  a: [msgEvents[4]],
                },
                sizeInBytes: 0,
                needTopics: new Set(),
              },
              {
                messagesByTopic: {
                  a: [],
                },
                sizeInBytes: 0,
                needTopics: new Set(),
              },
              {
                messagesByTopic: {
                  a: [],
                },
                sizeInBytes: 0,
                needTopics: new Set(),
              },
            ],
            startTime: { sec: 0, nsec: 0 },
          },
        });

        await loader.stopLoading();
      },
    });

    expect.assertions(1);
  });

  it("should reset loading when active time moves to an unloaded region", async () => {
    const source = new TestSource();

    const loader = new BlockLoader({
      maxBlocks: 6,
      cacheSizeBytes: 1,
      minBlockDurationNs: 1,
      source,
      start: { sec: 0, nsec: 0 },
      end: { sec: 9, nsec: 0 },
      problemManager: new PlayerProblemManager(),
    });

    const msgEvents: MessageEvent<unknown>[] = [];
    for (let i = 0; i < 10; ++i) {
      msgEvents.push({
        topic: "a",
        receiveTime: { sec: i, nsec: 0 },
        message: undefined,
        sizeInBytes: 0,
        schemaName: "foo",
      });
    }

    const messageIteratorCallArgs: MessageIteratorArgs[] = [];
    source.messageIterator = async function* messageIterator(
      args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      messageIteratorCallArgs.push(args);
      for (let i = 0; i < msgEvents.length; ++i) {
        const msgEvent = msgEvents[i]!;
        if (args.start && compare(msgEvent.receiveTime, args.start) < 0) {
          continue;
        }
        if (args.end && compare(msgEvent.receiveTime, args.end) > 0) {
          continue;
        }

        yield {
          msgEvent,
          problem: undefined,
          connectionId: undefined,
        };
      }
    };

    loader.setTopics(new Set("a"));

    let count = 0;
    await loader.startLoading({
      progress: async (progress) => {
        count += 1;

        if (count === 1) {
          loader.setActiveTime({ sec: 6, nsec: 0 });
          // eslint-disable-next-line jest/no-conditional-expect
          expect(progress).toEqual({
            fullyLoadedFractionRanges: [
              {
                start: 0,
                end: 0.16666666666666666,
              },
            ],
            messageCache: {
              blocks: [
                {
                  messagesByTopic: {
                    a: [msgEvents[0], msgEvents[1]],
                  },
                  needTopics: new Set(),
                  sizeInBytes: 0,
                },
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
              ],
              startTime: { sec: 0, nsec: 0 },
            },
          });
        } else if (count === 3) {
          loader.setActiveTime({ sec: 1, nsec: 0 });

          // eslint-disable-next-line jest/no-conditional-expect
          expect(progress).toEqual({
            fullyLoadedFractionRanges: [
              {
                start: 0,
                end: 0.16666666666666666,
              },
              {
                start: 0.5,
                end: 0.8333333333333334,
              },
            ],
            messageCache: {
              blocks: [
                {
                  messagesByTopic: {
                    a: [msgEvents[0], msgEvents[1]],
                  },
                  needTopics: new Set(),
                  sizeInBytes: 0,
                },
                undefined,
                undefined,
                {
                  messagesByTopic: {
                    a: [msgEvents[5], msgEvents[6]],
                  },
                  needTopics: new Set(),
                  sizeInBytes: 0,
                },
                {
                  messagesByTopic: {
                    a: [msgEvents[7]],
                  },
                  needTopics: new Set(),
                  sizeInBytes: 0,
                },
                undefined,
              ],
              startTime: { sec: 0, nsec: 0 },
            },
          });
        } else if (count === 4) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(progress).toEqual({
            fullyLoadedFractionRanges: [
              {
                start: 0,
                end: 0.3333333333333333,
              },
              {
                start: 0.5,
                end: 0.8333333333333334,
              },
            ],
            messageCache: {
              blocks: [
                {
                  messagesByTopic: {
                    a: [msgEvents[0], msgEvents[1]],
                  },
                  needTopics: new Set(),
                  sizeInBytes: 0,
                },
                {
                  messagesByTopic: {
                    a: [msgEvents[2], msgEvents[3]],
                  },
                  needTopics: new Set(),
                  sizeInBytes: 0,
                },
                undefined,
                {
                  messagesByTopic: {
                    a: [msgEvents[5], msgEvents[6]],
                  },
                  needTopics: new Set(),
                  sizeInBytes: 0,
                },
                {
                  messagesByTopic: {
                    a: [msgEvents[7]],
                  },
                  needTopics: new Set(),
                  sizeInBytes: 0,
                },
                undefined,
              ],
              startTime: { sec: 0, nsec: 0 },
            },
          });
        }

        // when progress matches what we want we've finished loading
        if (progress.messageCache?.blocks.every((item) => item != undefined) === true) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(progress).toEqual({
            fullyLoadedFractionRanges: [
              {
                start: 0,
                end: 1,
              },
            ],
            messageCache: {
              blocks: [
                {
                  messagesByTopic: {
                    a: [msgEvents[0], msgEvents[1]],
                  },
                  sizeInBytes: 0,
                  needTopics: new Set(),
                },
                {
                  messagesByTopic: {
                    a: [msgEvents[2], msgEvents[3]],
                  },
                  sizeInBytes: 0,
                  needTopics: new Set(),
                },
                {
                  messagesByTopic: {
                    a: [msgEvents[4]],
                  },
                  sizeInBytes: 0,
                  needTopics: new Set(),
                },
                {
                  messagesByTopic: {
                    a: [msgEvents[5], msgEvents[6]],
                  },
                  sizeInBytes: 0,
                  needTopics: new Set(),
                },
                {
                  messagesByTopic: {
                    a: [msgEvents[7]],
                  },
                  sizeInBytes: 0,
                  needTopics: new Set(),
                },
                {
                  messagesByTopic: {
                    a: [msgEvents[8], msgEvents[9]],
                  },
                  sizeInBytes: 0,
                  needTopics: new Set(),
                },
              ],
              startTime: { sec: 0, nsec: 0 },
            },
          });
          await loader.stopLoading();
        }
      },
    });

    expect(messageIteratorCallArgs).toEqual([
      {
        consumptionType: "full",
        topics: ["a"],
        start: { sec: 0, nsec: 0 },
        end: { sec: 9, nsec: 0 },
      },
      {
        consumptionType: "full",
        topics: ["a"],
        start: { sec: 4, nsec: 500000003 },
        end: { sec: 9, nsec: 0 },
      },
      {
        consumptionType: "full",
        topics: ["a"],
        start: { sec: 1, nsec: 500000001 },
        end: { sec: 4, nsec: 500000002 },
      },
      {
        consumptionType: "full",
        topics: ["a"],
        start: { sec: 7, nsec: 500000005 },
        end: { sec: 9, nsec: 0 },
      },
    ]);

    expect.assertions(5);
  });

  it("should avoid emitting progress when nothing changed", async () => {
    const source = new TestSource();

    const loader = new BlockLoader({
      maxBlocks: 2,
      cacheSizeBytes: 1,
      minBlockDurationNs: 1,
      source,
      start: { sec: 0, nsec: 0 },
      end: { sec: 5, nsec: 0 },
      problemManager: new PlayerProblemManager(),
    });

    const msgEvents: MessageEvent<unknown>[] = [];
    for (let i = 0; i < 4; ++i) {
      msgEvents.push({
        topic: "a",
        receiveTime: { sec: i, nsec: 0 },
        message: undefined,
        sizeInBytes: 0,
        schemaName: "foo",
      });
    }

    source.messageIterator = async function* messageIterator(
      _args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      for (let i = 0; i < msgEvents.length; ++i) {
        const msgEvent = msgEvents[i]!;
        yield {
          msgEvent,
          problem: undefined,
          connectionId: undefined,
        };
      }
    };

    loader.setTopics(new Set("a"));
    let count = 0;
    await loader.startLoading({
      progress: async (progress) => {
        count += 1;
        if (count > 2) {
          throw new Error("Too many progress callbacks");
        }

        if (count === 2) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(progress).toEqual({
            fullyLoadedFractionRanges: [
              {
                start: 0,
                end: 1,
              },
            ],
            messageCache: {
              blocks: [
                {
                  messagesByTopic: {
                    a: [msgEvents[0], msgEvents[1], msgEvents[2]],
                  },
                  sizeInBytes: 0,
                  needTopics: new Set(),
                },
                {
                  messagesByTopic: {
                    a: [msgEvents[3]],
                  },
                  sizeInBytes: 0,
                  needTopics: new Set(),
                },
              ],
              startTime: { sec: 0, nsec: 0 },
            },
          });

          // eslint-disable-next-line require-yield
          source.messageIterator = async function* messageIterator(
            _args: MessageIteratorArgs,
          ): AsyncIterableIterator<Readonly<IteratorResult>> {
            throw new Error("Should not call iterator");
          };

          // Everything has loaded so now we seek to a new time
          // We should not get any more progress updates
          setTimeout(() => {
            loader.setActiveTime({ sec: 4, nsec: 0 });
          }, 0);

          setTimeout(async () => {
            await loader.stopLoading();
          }, 500);
        }
      },
    });
  });
});
