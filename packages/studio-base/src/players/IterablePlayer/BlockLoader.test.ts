// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

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

  public async getBackfillMessages(_args: GetBackfillMessagesArgs): Promise<MessageEvent[]> {
    return [];
  }
}
const consoleErrorMock = console.error as ReturnType<typeof jest.fn>;
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

    const msgEvents: MessageEvent[] = [];
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
          type: "message-event",
          msgEvent,
        };
      }
    };

    loader.setTopics(new Set("a"));
    let count = 0;
    await loader.startLoading({
      progress: async (progress) => {
        if (++count < 5) {
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

  it("should not load messages past max cache size", async () => {
    const source = new TestSource();

    const loader = new BlockLoader({
      maxBlocks: 2,
      cacheSizeBytes: 3,
      minBlockDurationNs: 1,
      source,
      start: { sec: 0, nsec: 0 },
      end: { sec: 9, nsec: 0 },
      problemManager: new PlayerProblemManager(),
    });

    const msgEvents: MessageEvent[] = [];
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
          type: "message-event",
          msgEvent,
        };
      }
    };

    loader.setTopics(new Set("a"));
    await loader.startLoading({
      progress: async (progress) => {
        expect(progress).toEqual({
          fullyLoadedFractionRanges: [
            {
              start: 0,
              end: 0.5,
            },
          ],
          messageCache: {
            blocks: [
              {
                messagesByTopic: {
                  a: [msgEvents[0], msgEvents[1]],
                },
                needTopics: new Set(),
                sizeInBytes: 2,
              },
            ],
            startTime: { sec: 0, nsec: 0 },
          },
        });

        await loader.stopLoading();
      },
    });
    expect(consoleErrorMock.mock.calls[0] ?? []).toContain("cache-full");
    consoleErrorMock.mockClear();
    expect.assertions(2);
  });

  it("should remove unused topics on blocks if cache is full", async () => {
    const source = new TestSource();

    const loader = new BlockLoader({
      maxBlocks: 2,
      cacheSizeBytes: 6,
      minBlockDurationNs: 1,
      source,
      start: { sec: 0, nsec: 0 },
      end: { sec: 5, nsec: 0 },
      problemManager: new PlayerProblemManager(),
    });

    const msgEvents: MessageEvent[] = [];
    for (let i = 0; i < 4; ++i) {
      msgEvents.push({
        topic: "a",
        receiveTime: { sec: i, nsec: 0 },
        message: undefined,
        sizeInBytes: 1,
        schemaName: "foo",
      });
      msgEvents.push({
        topic: "b",
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
        // need to filter iterator by requested topics since there's messages from more than 1 topic in here
        if (_args.topics.includes(msgEvent.topic)) {
          yield {
            type: "message-event",
            msgEvent,
          };
        }
      }
    };

    loader.setTopics(new Set("a"));
    let count = 0;
    await loader.startLoading({
      progress: async (progress) => {
        count++;
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
                    a: [msgEvents[0], msgEvents[2], msgEvents[4]],
                  },
                  sizeInBytes: 3,
                  needTopics: new Set(),
                },
                {
                  messagesByTopic: {
                    a: [msgEvents[6]],
                  },
                  sizeInBytes: 1,
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

    loader.setTopics(new Set("b"));

    count = 0;
    // at the end of loading "b" topic it should have removed the "a" topic as its no longer used.
    await loader.startLoading({
      progress: async (progress) => {
        count += 1;
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
                    b: [msgEvents[1], msgEvents[3], msgEvents[5]],
                  },
                  sizeInBytes: 3,
                  needTopics: new Set(),
                },
                {
                  messagesByTopic: {
                    b: [msgEvents[7]],
                  },
                  sizeInBytes: 1,
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
    expect.assertions(2);
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

    const msgEvents: MessageEvent[] = [];
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
          type: "message-event",
          msgEvent,
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

          setTimeout(async () => {
            await loader.stopLoading();
          }, 500);
        }
      },
    });
  });
});
