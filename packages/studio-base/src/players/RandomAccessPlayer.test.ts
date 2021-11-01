/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

/* eslint-disable jest/no-conditional-expect */

import { omit } from "lodash";

import { Time, add, fromNanoSec } from "@foxglove/rostime";
import {
  MessageEvent,
  PlayerCapabilities,
  PlayerMetricsCollectorInterface,
  PlayerPresence,
  PlayerState,
} from "@foxglove/studio-base/players/types";
import {
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import delay from "@foxglove/studio-base/util/delay";
import signal from "@foxglove/studio-base/util/signal";
import { getSeekToTime, SEEK_ON_START_NS } from "@foxglove/studio-base/util/time";

import RandomAccessPlayer, {
  RandomAccessPlayerOptions,
  SEEK_BACK_NANOSECONDS,
  SEEK_START_DELAY_MS,
} from "./RandomAccessPlayer";
import TestProvider from "./TestProvider";

// By default seek to the start of the bag, since that makes things a bit simpler to reason about.
const playerOptions: RandomAccessPlayerOptions = {
  metricsCollector: undefined,
  seekToTime: { type: "absolute", time: { sec: 10, nsec: 0 } },
};

type PlayerStateWithoutPlayerId = Omit<PlayerState, "playerId">;

class MessageStore {
  private _messages: PlayerStateWithoutPlayerId[] = [];
  done: Promise<PlayerStateWithoutPlayerId[]>;
  private _expected: number;
  private _resolve: (arg0: PlayerStateWithoutPlayerId[]) => void = () => {
    // no-op
  };
  constructor(expected: number) {
    this._expected = expected;
    this.done = new Promise((resolve) => {
      this._resolve = resolve;
    });
  }

  add = async (message: PlayerState): Promise<void> => {
    this._messages.push(omit(message, ["playerId"]));
    if (this._messages.length === this._expected) {
      this._resolve(this._messages);
    }
    if (this._messages.length > this._expected) {
      const error = new Error(
        `Expected: ${this._expected} messages, received: ${this._messages.length}`,
      );
      this.done = Promise.reject(error);
      throw error;
    }
  };

  reset = (expected: number): void => {
    this._expected = expected;
    this._messages = [];
    this.done = new Promise((resolve) => {
      this._resolve = resolve;
    });
  };
}

const getMessagesResult = { parsedMessages: [], rosBinaryMessages: undefined };

describe("RandomAccessPlayer", () => {
  let mockDateNow: jest.SpyInstance<number, []>;
  beforeEach(() => {
    mockDateNow = jest.spyOn(Date, "now").mockReturnValue(0);
  });
  afterEach(async () => {
    mockDateNow.mockRestore();
    // Always wait to ensure that errors are contained to their own tests.
    await delay(SEEK_START_DELAY_MS + 10);
  });

  it("calls listener with player initial player state and data types", async () => {
    const provider = new TestProvider();
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    const store = new MessageStore(2);
    source.setListener(store.add);
    const messages = await store.done;
    expect(messages).toEqual([
      {
        activeData: undefined,
        capabilities: [],
        presence: PlayerPresence.INITIALIZING,
        progress: {},
      },
      {
        activeData: {
          currentTime: { sec: 10, nsec: 0 },
          datatypes: new Map(
            Object.entries({
              baz: { definitions: [{ name: "val", type: "number" }] },
              fooBar: { definitions: [{ name: "val", type: "number" }] },
            }),
          ),
          endTime: { sec: 100, nsec: 0 },
          isPlaying: false,
          lastSeekTime: 0,
          messages: [],
          totalBytesReceived: 0,
          messageOrder: "receiveTime",
          speed: 0.2,
          startTime: { sec: 10, nsec: 0 },
          topics: [
            { datatype: "fooBar", name: "/foo/bar" },
            { datatype: "baz", name: "/baz" },
          ],
          parsedMessageDefinitionsByTopic: {},
          publishedTopics: new Map<string, Set<string>>(),
        },
        capabilities: [PlayerCapabilities.setSpeed, PlayerCapabilities.playbackControl],
        presence: PlayerPresence.PRESENT,
        progress: {},
      },
    ]);

    source.close();
  });

  it("with the default seekToTime it seeks into the bag by a bit, so that there's something useful on the screen", async () => {
    const provider = new TestProvider();
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      { ...playerOptions, seekToTime: getSeekToTime() },
    );
    const store = new MessageStore(2);
    source.setListener(store.add);
    const messages: any = await store.done;
    expect(messages[1].activeData.currentTime).toEqual(
      add({ sec: 10, nsec: 0 }, fromNanoSec(SEEK_ON_START_NS)),
    );

    source.close();
  });

  it("calls listener with player state changes on play/pause", async () => {
    const provider = new TestProvider();
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    const store = new MessageStore(2);
    source.setListener(store.add);
    // make getMessages do nothing since we're going to start reading
    provider.getMessages = async () =>
      await new Promise(() => {
        // no-op
      });
    const messages = await store.done;
    expect(
      messages.map(
        (msg) =>
          (
            msg.activeData ?? {
              messages: [],
            }
          ).isPlaying,
      ),
    ).toEqual([undefined, false]);
    store.reset(1);
    source.startPlayback();
    const messages2 = await store.done;
    expect(
      messages2.map(
        (msg) =>
          (
            msg.activeData ?? {
              messages: [],
            }
          ).isPlaying,
      ),
    ).toEqual([true]);
    store.reset(1);
    source.startPlayback();
    source.pausePlayback();
    const messages3 = await store.done;
    expect(
      messages3.map(
        (msg) =>
          (
            msg.activeData ?? {
              messages: [],
            }
          ).isPlaying,
      ),
    ).toEqual([false]);

    source.close();
  });

  it("calls listener with speed changes", async () => {
    const provider = new TestProvider();
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    const store = new MessageStore(2);
    source.setListener(store.add);
    // allow initialization messages to come in
    await store.done;
    // wait for each playback speed change
    store.reset(1);
    source.setPlaybackSpeed(0.5);
    expect(
      (await store.done).map(
        (msg) =>
          (
            msg.activeData ?? {
              messages: [],
            }
          ).speed,
      ),
    ).toEqual([0.5]);
    store.reset(1);
    source.setPlaybackSpeed(1);
    expect(
      (await store.done).map(
        (msg) =>
          (
            msg.activeData ?? {
              messages: [],
            }
          ).speed,
      ),
    ).toEqual([1]);
    store.reset(1);
    source.setPlaybackSpeed(0.2);
    expect(
      (await store.done).map(
        (msg) =>
          (
            msg.activeData ?? {
              messages: [],
            }
          ).speed,
      ),
    ).toEqual([0.2]);

    source.close();
  });

  it("reads messages when playing back", async () => {
    expect.assertions(7);
    const provider = new TestProvider();
    let callCount = 0;
    provider.getMessages = async (
      start: Time,
      end: Time,
      topics: GetMessagesTopics,
    ): Promise<GetMessagesResult> => {
      callCount++;
      switch (callCount) {
        case 1:
          // initial getMessages from player initialization
          expect(start).toEqual({ sec: 10, nsec: 0 });
          expect(end).toEqual({ sec: 10, nsec: 0 });
          return getMessagesResult;

        case 2: {
          expect(start).toEqual({ sec: 10, nsec: 0 });
          expect(end).toEqual({ sec: 10, nsec: 4000000 });
          expect(topics).toEqual({ parsedMessages: ["/foo/bar"] });
          const parsedMessages: MessageEvent<unknown>[] = [
            {
              topic: "/foo/bar",
              receiveTime: { sec: 10, nsec: 2 },
              message: { payload: "foo bar" },
            },
          ];
          return { ...getMessagesResult, parsedMessages };
        }

        case 3: {
          expect(start).toEqual({ sec: 10, nsec: 4000001 });
          return getMessagesResult;
        }

        default:
          throw new Error("getMessages called too many times");
      }
    };

    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    const store = new MessageStore(5);
    source.setListener(store.add);
    await Promise.resolve();

    source.setSubscriptions([{ topic: "/foo/bar" }]);
    source.requestBackfill(); // We always get a `requestBackfill` after each `setSubscriptions`.
    source.startPlayback();
    const messages = await store.done;
    // close the player to stop more reads
    source.close();

    const messagePayloads = messages.map((msg) => {
      return { messages: msg.activeData?.messages ?? [] };
    });
    expect(messagePayloads).toEqual([
      { messages: [] },
      { messages: [] },
      { messages: [] },
      {
        messages: [
          {
            topic: "/foo/bar",
            receiveTime: { sec: 10, nsec: 2 },
            message: { payload: "foo bar" },
          },
        ],
      },
      { messages: [] },
    ]);
  });

  it("does not ask the data provider for data when it has no subscriptions", async () => {
    const provider = new TestProvider();
    provider.getMessages = async (): Promise<GetMessagesResult> => {
      throw new Error("getMessages should not be called");
    };

    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    const store = new MessageStore(5);
    source.setListener(store.add);

    source.setSubscriptions([]);
    source.requestBackfill(); // We always get a `requestBackfill` after each `setSubscriptions`.
    source.startPlayback();
    const messages = await store.done;
    // close the player to stop more reads
    source.close();

    const messagePayloads = messages.map((msg) => {
      return { messages: msg.activeData?.messages ?? [] };
    });
    expect(messagePayloads).toEqual([
      { messages: [] }, // 1
      { messages: [] }, // 2
      { messages: [] }, // 3
      { messages: [] }, // 4
      { messages: [] }, // 5
    ]);
  });

  it("still moves forward time if there are no messages", async () => {
    const provider = new TestProvider();
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );

    let callCount = 0;
    provider.getMessages = async (
      start: Time,
      end: Time,
      topics: GetMessagesTopics,
    ): Promise<GetMessagesResult> => {
      callCount++;
      switch (callCount) {
        case 1:
          // initial getMessages from player initialization
          expect(start).toEqual({ sec: 10, nsec: 0 });
          expect(end).toEqual({ sec: 10, nsec: 0 });
          expect(topics).toEqual({ parsedMessages: ["/foo/bar"] });
          return getMessagesResult;

        case 2:
          expect(start).toEqual({ sec: 10, nsec: 0 });
          expect(end).toEqual({ sec: 10, nsec: 4000000 });
          expect(topics).toEqual({ parsedMessages: ["/foo/bar"] });
          source.pausePlayback();
          return getMessagesResult;

        default:
          throw new Error("getMessages called too many times");
      }
    };

    const store = new MessageStore(4);
    source.setListener(store.add);
    await Promise.resolve();
    source.setSubscriptions([{ topic: "/foo/bar" }]);
    source.requestBackfill(); // We always get a `requestBackfill` after each `setSubscriptions`.
    source.startPlayback();
    const messages = await store.done;
    // close the player to stop more reads
    source.close();
    const messagePayloads = messages.map((msg) => {
      return { messages: msg.activeData?.messages ?? [] };
    });
    expect(messagePayloads).toEqual([
      { messages: [] },
      { messages: [] },
      { messages: [] },
      { messages: [] },
    ]);
  });

  it("pauses and does not emit messages after pause", async () => {
    const provider = new TestProvider();
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );

    let callCount = 0;
    provider.getMessages = async (
      start: Time,
      end: Time,
      topics: GetMessagesTopics,
    ): Promise<GetMessagesResult> => {
      callCount++;
      switch (callCount) {
        case 1:
          // initial getMessages from player initialization
          expect(start).toEqual({ sec: 10, nsec: 0 });
          expect(end).toEqual({ sec: 10, nsec: 0 });
          expect(topics).toEqual({ parsedMessages: ["/foo/bar"] });
          return getMessagesResult;

        case 2: {
          expect(start).toEqual({ sec: 10, nsec: 0 });
          expect(end).toEqual({ sec: 10, nsec: 4000000 });
          expect(topics).toEqual({ parsedMessages: ["/foo/bar"] });
          const parsedMessages: MessageEvent<unknown>[] = [
            {
              topic: "/foo/bar",
              receiveTime: { sec: 10, nsec: 0 },
              message: { payload: "foo bar" },
            },
          ];
          return { ...getMessagesResult, parsedMessages };
        }

        case 3:
          source.pausePlayback();
          return {
            ...getMessagesResult,
            parsedMessages: [
              {
                topic: "/foo/bar",
                receiveTime: start,
                message: "this message should not be emitted",
              },
            ],
          } as any;

        default:
          throw new Error("getMessages called too many times");
      }
    };

    const store = new MessageStore(5);
    source.setListener(store.add);
    await Promise.resolve();
    source.setSubscriptions([{ topic: "/foo/bar" }]);
    source.requestBackfill(); // We always get a `requestBackfill` after each `setSubscriptions`.

    source.startPlayback();
    const messages = await store.done;
    const messagePayloads = messages.map((msg) => {
      return { messages: msg.activeData?.messages ?? [] };
    });
    expect(messagePayloads).toEqual([
      { messages: [] },
      { messages: [] },
      { messages: [] },
      {
        messages: [
          {
            topic: "/foo/bar",
            receiveTime: { sec: 10, nsec: 0 },
            message: { payload: "foo bar" },
          },
        ],
      }, // this is the 'pause' messages payload - should be empty:
      { messages: [] },
    ]);

    source.close();
  });

  it("seek during reading discards messages before seek", async () => {
    const provider = new TestProvider();
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    let callCount = 0;
    provider.getMessages = async (
      start: Time,
      end: Time,
      topics: GetMessagesTopics,
    ): Promise<GetMessagesResult> => {
      expect(topics).toEqual({ parsedMessages: ["/foo/bar"] });
      callCount++;
      switch (callCount) {
        case 1:
          // initial getMessages from player initialization
          expect(start).toEqual({ sec: 10, nsec: 0 });
          expect(end).toEqual({ sec: 10, nsec: 0 });
          return getMessagesResult;
        case 2: {
          expect(start).toEqual({ sec: 10, nsec: 0 });
          expect(end).toEqual({ sec: 10, nsec: 4000000 });
          const parsedMessages: MessageEvent<unknown>[] = [
            {
              topic: "/foo/bar",
              receiveTime: { sec: 10, nsec: 0 },
              message: { payload: "foo bar" },
            },
          ];
          await delay(10);
          mockDateNow.mockReturnValue(Date.now() + 1);
          source.seekPlayback({ sec: 10, nsec: 0 });
          return { ...getMessagesResult, parsedMessages };
        }

        case 3:
          source.pausePlayback();
          return {
            ...getMessagesResult,
            parsedMessages: [
              {
                topic: "/foo/bar",
                receiveTime: start,
                message: "this message should not be emitted",
              },
            ],
          } as any;

        default:
          throw new Error("getMessages called too many times");
      }
    };

    const store = new MessageStore(4);
    source.setListener(store.add);
    await Promise.resolve();
    source.setSubscriptions([{ topic: "/foo/bar" }]);
    source.requestBackfill(); // We always get a `requestBackfill` after each `setSubscriptions`.
    source.startPlayback();

    const messages = await store.done;
    expect(messages).toHaveLength(4);
    const activeDatas = messages.map(
      (msg) =>
        msg.activeData ?? {
          messages: [],
        },
    );
    expect(activeDatas.map((d: any) => d.lastSeekTime)).toEqual([
      undefined, // "start up" message
      0,
      0,
      1, // The last emit should have a different seek time.
    ]);
    expect(activeDatas.map((d: any) => d.currentTime)).toEqual([
      undefined, // "start up" message
      { sec: 10, nsec: 0 },
      { sec: 10, nsec: 0 },
      { sec: 10, nsec: 0 },
    ]);
    expect(activeDatas.map((d) => ({ messages: d.messages }))).toEqual([
      { messages: [] },
      { messages: [] },
      { messages: [] },
      { messages: [] },
    ]);

    source.close();
  });

  it("only emits a new lastSeekTime when seeking is actually done", async () => {
    const provider = new TestProvider();
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    let callCount = 0;
    provider.getMessages = async (): Promise<GetMessagesResult> => {
      callCount++;
      switch (callCount) {
        case 1: {
          // This is the getMessages call from `seekPlayback`

          // Simulate a progress callback while we are waiting for `getMessages`
          provider.extensionPoint?.progressCallback({});
          await delay(1);
          // The actual message is irrelevant
          const parsedMessages: MessageEvent<unknown>[] = [
            {
              topic: "/foo/bar",
              receiveTime: { sec: 10, nsec: 5 },
              message: { payload: "foo bar" },
            },
          ];
          return { ...getMessagesResult, parsedMessages };
        }
        default:
          throw new Error("getMessages called too many times");
      }
    };

    const store = new MessageStore(2);
    source.setListener(store.add);
    await store.done;
    source.setSubscriptions([{ topic: "/foo/bar" }]);

    store.reset(2);

    mockDateNow.mockReturnValue(Date.now() + 1);
    source.seekPlayback({ sec: 20, nsec: 50 });

    const messages = await store.done;
    const seekTimeAndMessages = messages.map(({ activeData }) => ({
      lastSeekTime: activeData?.lastSeekTime,
      messages: activeData?.messages,
    }));
    expect(seekTimeAndMessages).toEqual([
      // This is from the progress callback - the seek time should not yet be incremented.
      { lastSeekTime: 0, messages: [] }, // This is from the seek - the seek time should now be incremented and we should have new messages alongside it.
      {
        lastSeekTime: 1,
        messages: [
          {
            topic: "/foo/bar",
            receiveTime: { sec: 10, nsec: 5 },
            message: { payload: "foo bar" },
          },
        ],
      },
    ]);

    source.close();
    await delay(1);
  });

  it("does not emit when getting a progressCallback when playing", async () => {
    const provider = new TestProvider();
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    let callCount = 0;
    const progressDuringPlayback: any = { duringPlayback: true };
    const progressAfterPause: any = { afterPause: true };
    provider.getMessages = async (): Promise<GetMessagesResult> => {
      callCount++;
      switch (callCount) {
        case 1: {
          // This is the getMessages call from the playback tick
          // Simulate a progress callback while we are playing
          provider.extensionPoint?.progressCallback(progressDuringPlayback);
          await delay(1);
          // The actual message is irrelevant
          const parsedMessages: MessageEvent<unknown>[] = [
            {
              topic: "/foo/bar",
              receiveTime: { sec: 10, nsec: 5 },
              message: { payload: "foo bar" },
            },
          ];
          return { ...getMessagesResult, parsedMessages };
        }
        case 2: {
          source.pausePlayback();
          await delay(1);
          provider.extensionPoint?.progressCallback(progressAfterPause);
          return getMessagesResult;
        }
        default:
          throw new Error("getMessages called too many times");
      }
    };

    const store = new MessageStore(2);
    source.setListener(store.add);
    await store.done;
    source.setSubscriptions([{ topic: "/foo/bar" }]);

    store.reset(4);

    // Wait for player messages to settle so we can assert on exact message contents later
    await delay(1);

    source.startPlayback();

    const messages = await store.done;
    const messagesAndIsPlaying = messages.map(({ activeData, progress }) => ({
      progress,
      messages: activeData?.messages,
      isPlaying: activeData?.isPlaying,
    }));
    expect(messagesAndIsPlaying).toEqual([
      // Initial emit for playing.
      { progress: {}, messages: [], isPlaying: true }, // We should not get an emit from the progress callback.
      {
        progress: progressDuringPlayback,
        messages: [
          {
            topic: "/foo/bar",
            receiveTime: { sec: 10, nsec: 5 },
            message: { payload: "foo bar" },
          },
        ],
        isPlaying: true,
      }, // One emit for pausing.
      { progress: progressDuringPlayback, messages: [], isPlaying: false }, // Emit progress after pausing.
      { progress: progressAfterPause, messages: [], isPlaying: false },
    ]);

    source.close();
    await delay(1);
  });

  it("backfills previous messages on seek", async () => {
    const provider = new TestProvider();
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    let callCount = 0;
    provider.getMessages = async (
      start: Time,
      end: Time,
      topics: GetMessagesTopics,
    ): Promise<GetMessagesResult> => {
      callCount++;
      switch (callCount) {
        case 1: {
          expect(start).toEqual({ sec: 19, nsec: 1e9 + 50 - SEEK_BACK_NANOSECONDS });
          expect(end).toEqual({ sec: 20, nsec: 50 });
          expect(topics).toEqual({ parsedMessages: ["/foo/bar"] });
          const parsedMessages: MessageEvent<unknown>[] = [
            {
              topic: "/foo/bar",
              receiveTime: { sec: 10, nsec: 5 },
              message: { payload: "foo bar" },
            },
          ];
          return { ...getMessagesResult, parsedMessages };
        }
        case 2:
          // make sure after we seek & read again we read exactly from the right nanosecond
          expect(start).toEqual({ sec: 20, nsec: 51 });
          return {
            ...getMessagesResult,
            parsedMessages: [
              {
                topic: "/foo/bar",
                receiveTime: { sec: 10, nsec: 101 },
                message: { payload: "baz" },
              },
            ],
          };
        case 3:
          source.pausePlayback();
          return getMessagesResult;
        default:
          throw new Error("getMessages called too many times");
      }
    };

    const store = new MessageStore(2);
    source.setListener(store.add);
    const done = await store.done;
    expect(done).toEqual([
      expect.objectContaining({ activeData: undefined }),
      expect.objectContaining({ activeData: expect.any(Object) }),
    ]);

    store.reset(1);
    source.setSubscriptions([{ topic: "/foo/bar" }]);
    source.requestBackfill(); // We always get a `requestBackfill` after each `setSubscriptions`.
    // Ensure results from the backfill always thrown away after the new seek, by making the lastSeekTime change.
    mockDateNow.mockReturnValue(Date.now() + 1);
    source.seekPlayback({ sec: 20, nsec: 50 });

    const messages = await store.done;
    expect(messages.map((msg) => (msg.activeData ? msg.activeData.messages : []))).toEqual([
      [
        {
          topic: "/foo/bar",
          receiveTime: { sec: 10, nsec: 5 },
          message: { payload: "foo bar" },
        },
      ],
    ]);
    store.reset(3);
    source.startPlayback();
    const messages2 = await store.done;
    expect(
      messages2.map(
        (msg) =>
          (
            msg.activeData ?? {
              messages: [],
            }
          ).messages,
      ),
    ).toEqual([
      [],
      [
        {
          topic: "/foo/bar",
          receiveTime: { sec: 10, nsec: 101 },
          message: { payload: "baz" },
        },
      ],
      [],
    ]);

    source.close();
  });

  it("discards backfilled messages if we started playing after the seek", async () => {
    const provider = new TestProvider();
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    let callCount = 0;
    let backfillPromiseCallback: ((_: GetMessagesResult) => void) | undefined;
    provider.getMessages = async (
      start: Time,
      end: Time,
      topics: GetMessagesTopics,
    ): Promise<GetMessagesResult> => {
      callCount++;
      switch (callCount) {
        case 1: {
          expect(start).toEqual({ sec: 19, nsec: 1e9 + 50 - SEEK_BACK_NANOSECONDS });
          expect(end).toEqual({ sec: 20, nsec: 50 });
          expect(topics).toEqual({ parsedMessages: ["/foo/bar"] });
          return await new Promise((resolve) => {
            backfillPromiseCallback = resolve;
          });
        }
        case 2:
          // make sure after we seek & read again we read exactly from the right nanosecond
          expect(start).toEqual({ sec: 20, nsec: 50 });
          return {
            ...getMessagesResult,
            parsedMessages: [
              {
                topic: "/foo/bar",
                receiveTime: { sec: 20, nsec: 50 },
                message: { payload: "baz" },
              },
            ],
          };
        case 3:
          source.pausePlayback();
          return getMessagesResult;
        default:
          throw new Error("getMessages called too many times");
      }
    };

    const store = new MessageStore(2);
    source.setListener(store.add);
    expect(await store.done).toEqual([
      expect.objectContaining({ activeData: undefined }),
      expect.objectContaining({ activeData: expect.any(Object) }),
    ]);

    store.reset(3);
    source.setSubscriptions([{ topic: "/foo/bar" }]);
    source.requestBackfill(); // We always get a `requestBackfill` after each `setSubscriptions`.
    // Ensure results from the backfill always thrown away after the new seek, by making the lastSeekTime change.
    mockDateNow.mockReturnValue(Date.now() + 1);
    source.seekPlayback({ sec: 20, nsec: 50 });

    await delay(100);
    if (!backfillPromiseCallback) {
      throw new Error("backfillPromiseCallback should be set");
    }
    source.startPlayback();
    const messages = await store.done;
    expect(
      messages.map(
        (msg) =>
          (
            msg.activeData ?? {
              messages: [],
            }
          ).messages,
      ),
    ).toEqual([
      [],
      [
        {
          topic: "/foo/bar",
          receiveTime: { sec: 20, nsec: 50 },
          message: { payload: "baz" },
        },
      ],
      [], // pausePlayback
    ]);

    store.reset(0); // We expect 0 more messages; this will throw an error later if we received more.
    const result: MessageEvent<unknown> = {
      topic: "/foo/bar",
      receiveTime: { sec: 10, nsec: 5 },
      message: { payload: "foo bar" },
    };
    backfillPromiseCallback({ ...getMessagesResult, parsedMessages: [result] });
    await delay(10);

    source.close();
  });

  it("clamps times passed to the RandomAccessDataProvider", async () => {
    const provider = new TestProvider();
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    source.setSubscriptions([{ topic: "/foo/bar" }]);
    source.requestBackfill(); // We always get a `requestBackfill` after each `setSubscriptions`.

    let lastGetMessagesCall:
      | {
          start: Time;
          end: Time;
          topics: GetMessagesTopics;
          resolve: (_: GetMessagesResult) => void;
        }
      | undefined;
    const getMessages = async (
      start: Time,
      end: Time,
      topics: GetMessagesTopics,
    ): Promise<GetMessagesResult> => {
      return await new Promise((resolve) => {
        lastGetMessagesCall = { start, end, topics, resolve };
      });
    };
    provider.getMessages = getMessages;

    source.setListener(async () => {});
    await Promise.resolve();
    source.setSubscriptions([{ topic: "/foo/bar" }]);
    source.requestBackfill(); // We always get a `requestBackfill` after each `setSubscriptions`.

    // Resolve original seek.
    if (!lastGetMessagesCall) {
      throw new Error("lastGetMessagesCall not set");
    }
    lastGetMessagesCall.resolve(getMessagesResult);

    // Try to seek to a time before the start time
    source.seekPlayback({ sec: 0, nsec: 250 });

    await delay(1);
    lastGetMessagesCall.resolve(getMessagesResult);
    expect(lastGetMessagesCall).toEqual({
      start: { sec: 10, nsec: 0 }, // Clamped to start
      end: { sec: 10, nsec: 1 }, // Clamped to start
      topics: { parsedMessages: ["/foo/bar"] },
      resolve: expect.any(Function),
    });

    // Test clamping to end time.
    lastGetMessagesCall.resolve(getMessagesResult);
    source.seekPlayback(add({ sec: 100, nsec: 0 }, { sec: 0, nsec: -100 }));
    lastGetMessagesCall.resolve(getMessagesResult);
    source.startPlayback();
    expect(lastGetMessagesCall).toEqual({
      start: { nsec: 999999900, sec: 99 },
      end: { nsec: 0, sec: 100 },
      topics: { parsedMessages: ["/foo/bar"] },
      resolve: expect.any(Function),
    });

    source.close();
  });

  it("gets messages when requestBackfill is called", async () => {
    expect.assertions(5);
    const provider = new TestProvider();
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );

    let callCount = 0;
    provider.getMessages = async (
      _start: Time,
      _end: Time,
      topics: GetMessagesTopics,
    ): Promise<GetMessagesResult> => {
      callCount++;
      switch (callCount) {
        case 1:
          // initial getMessages from player initialization
          expect(topics).toEqual({ parsedMessages: ["/foo/bar"] });
          return getMessagesResult;

        case 2:
          expect(topics).toEqual({ parsedMessages: ["/foo/bar", "/baz"] });
          return getMessagesResult;

        case 3:
          // The `requestBackfill` without a `setSubscriptions` is identical to the one above.
          expect(topics).toEqual({ parsedMessages: ["/foo/bar", "/baz"] });
          return getMessagesResult;

        case 4:
          expect(topics).toEqual({ parsedMessages: ["/baz"] });
          return getMessagesResult;

        // Never called with empty topics!

        default:
          throw new Error("getMessages called too many times");
      }
    };

    const store = new MessageStore(9);
    source.setListener(store.add);
    await delay(1);
    source.setSubscriptions([{ topic: "/foo/bar" }, { topic: "/new/topic" }]);
    source.requestBackfill(); // We always get a `requestBackfill` after each `setSubscriptions`.
    await delay(1);
    source.setSubscriptions([{ topic: "/foo/bar" }, { topic: "/baz" }]);
    source.requestBackfill();
    await delay(1);
    source.requestBackfill(); // We can also get a requestBackfill without a `setSubscriptions`.
    await delay(1);
    source.setSubscriptions([{ topic: "/new/topic" }, { topic: "/baz" }]);
    source.requestBackfill();
    await delay(1);
    source.setSubscriptions([{ topic: "/new/topic" }]);
    source.requestBackfill();
    await delay(1);
    source.startPlayback();
    await delay(1);
    const messages = await store.done;
    expect(messages.length).toEqual(9);

    source.close();
  });

  it("reads a bunch of messages", async () => {
    const provider = new TestProvider();
    const items: MessageEvent<unknown>[] = [
      {
        topic: "/foo/bar",
        receiveTime: { sec: 10, nsec: 0 },
        message: { payload: "foo bar 1" },
      },
      {
        topic: "/baz",
        receiveTime: { sec: 10, nsec: 500 },
        message: { payload: "baz 1" },
      },
      {
        topic: "/baz",
        receiveTime: { sec: 10, nsec: 5000 },
        message: { payload: "baz 2" },
      },
      {
        topic: "/foo/bar",
        receiveTime: { sec: 10, nsec: 9000000 },
        message: { payload: "foo bar 2" },
      },
    ];
    let resolve: any;
    const done = new Promise((_resolve) => (resolve = _resolve));
    provider.getMessages = async (
      _start: Time,
      _end: Time,
      topics: GetMessagesTopics,
    ): Promise<GetMessagesResult> => {
      expect(topics).toEqual({ parsedMessages: ["/foo/bar", "/baz"] });
      const next = items.shift();
      if (!next) {
        resolve();
        return getMessagesResult;
      }
      return { ...getMessagesResult, parsedMessages: [next] };
    };

    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    const messagesReceived: MessageEvent<unknown>[] = [];
    source.setListener(async (playerState) => {
      messagesReceived.push(
        ...(
          playerState.activeData ?? {
            messages: [],
          }
        ).messages,
      );
    });
    source.setSubscriptions([{ topic: "/foo/bar" }, { topic: "/baz" }]);
    source.requestBackfill(); // We always get a `requestBackfill` after each `setSubscriptions`.
    source.startPlayback();
    await done;
    source.pausePlayback();
    expect(messagesReceived).toEqual([
      {
        topic: "/foo/bar",
        receiveTime: { sec: 10, nsec: 0 },
        message: { payload: "foo bar 1" },
      },
      {
        topic: "/baz",
        receiveTime: { sec: 10, nsec: 500 },
        message: { payload: "baz 1" },
      },
      {
        topic: "/baz",
        receiveTime: { sec: 10, nsec: 5000 },
        message: { payload: "baz 2" },
      },
      {
        topic: "/foo/bar",
        receiveTime: { sec: 10, nsec: 9000000 },
        message: { payload: "foo bar 2" },
      },
    ]);

    source.close();
  });

  it("closes provider when closed", async () => {
    const provider = new TestProvider();
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    source.setListener(async () => {});
    await Promise.resolve();
    source.close();
    expect(provider.closed).toBe(true);
  });

  it("doesn't try to close provider after initialization error", async () => {
    class FailTestProvider extends TestProvider {
      override async initialize(): Promise<InitializationResult> {
        throw new Error("fake initialization failure");
      }
    }
    const provider = new FailTestProvider();
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );

    const store = new MessageStore(2);
    source.setListener(store.add);
    expect(provider.closed).toBe(false);

    source.close();
    const messages = await store.done;
    expect(provider.closed).toBe(false);

    expect(messages).toEqual([
      expect.objectContaining({ presence: PlayerPresence.INITIALIZING, activeData: undefined }),
      expect.objectContaining({
        capabilities: [],
        presence: PlayerPresence.ERROR,
        activeData: undefined,
        progress: {},
        problems: [
          {
            error: new Error("fake initialization failure"),
            message: "Error initializing player",
            severity: "error",
          },
        ],
      }),
    ]);
  });

  it("reports when a provider is reconnecting", (done) => {
    expect.assertions(0);
    const provider = new TestProvider();
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    source.setListener(async (state) => {
      if (state.presence === PlayerPresence.PRESENT) {
        setImmediate(() =>
          provider.extensionPoint?.reportMetadataCallback({
            type: "updateReconnecting",
            reconnecting: true,
          }),
        );
      } else if (state.presence === PlayerPresence.RECONNECTING) {
        done();
      }
    });
  });

  it("waits for previous read to finish when pausing and playing again", async () => {
    const provider = new TestProvider();
    const getMessages = jest.fn();
    provider.getMessages = getMessages;

    const message1 = {
      topic: "/foo/bar",
      receiveTime: { sec: 10, nsec: 0 },
      message: { payload: "foo bar 1" },
    };
    const message2 = {
      topic: "/foo/bar",
      receiveTime: { sec: 10, nsec: 2 },
      message: { payload: "foo bar 2" },
    };

    const player = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    player.setSubscriptions([{ topic: "/foo/bar" }]);
    player.requestBackfill(); // We always get a `requestBackfill` after each `setSubscriptions`.

    const firstGetMessagesCall = signal();
    const firstGetMessagesReturn = signal();
    const secondGetMessagesCall = signal();
    const secondGetMessagesReturn = signal();

    const messages1 = [message1];
    getMessages.mockImplementation(async () => {
      firstGetMessagesCall.resolve();
      await firstGetMessagesReturn;
      return { ...getMessagesResult, parsedMessages: messages1.splice(0, 1) };
    });

    const store = new MessageStore(2);
    player.setListener(store.add);
    await Promise.resolve();
    player.startPlayback();

    await firstGetMessagesCall;
    expect(getMessages.mock.calls).toEqual([
      [{ sec: 10, nsec: 0 }, { sec: 10, nsec: 4000000 }, { parsedMessages: ["/foo/bar"] }],
    ]);

    expect(await store.done).toEqual([
      expect.objectContaining({ activeData: undefined }),
      expect.objectContaining({
        activeData: expect.objectContaining({ isPlaying: true, messages: [] }),
      }),
    ]);

    const messages2 = [message2];
    getMessages.mockImplementation(async () => {
      secondGetMessagesCall.resolve();
      await secondGetMessagesReturn;
      return { ...getMessagesResult, parsedMessages: messages2.splice(0, 1) };
    });
    store.reset(2);

    await Promise.resolve();
    player.pausePlayback();
    await Promise.resolve();
    await Promise.resolve();
    player.startPlayback();

    expect(await store.done).toEqual([
      expect.objectContaining({
        activeData: expect.objectContaining({ isPlaying: false, messages: [] }),
      }),
      expect.objectContaining({
        activeData: expect.objectContaining({ isPlaying: true, messages: [] }),
      }),
    ]);

    store.reset(1);

    // The second getMessages call should only happen once the first getMessages has returned
    await Promise.resolve();
    expect(getMessages).toHaveBeenCalledTimes(1);
    firstGetMessagesReturn.resolve();
    await secondGetMessagesCall;
    expect(getMessages).toHaveBeenCalledTimes(2);

    expect(await store.done).toEqual([
      expect.objectContaining({
        activeData: expect.objectContaining({
          isPlaying: true,
          messages: [expect.objectContaining(message1)],
        }),
      }),
    ]);

    store.reset(1);
    secondGetMessagesReturn.resolve();
    expect(await store.done).toEqual([
      expect.objectContaining({
        activeData: expect.objectContaining({
          isPlaying: true,
          messages: [expect.objectContaining(message2)],
        }),
      }),
    ]);

    store.reset(1);
    player.pausePlayback();
    expect(await store.done).toEqual([
      expect.objectContaining({
        activeData: expect.objectContaining({ isPlaying: false, messages: [] }),
      }),
    ]);

    player.close();
  });

  describe("metrics collecting", () => {
    class TestMetricsCollector implements PlayerMetricsCollectorInterface {
      private _initialized: number = 0;
      private _played: number = 0;
      private _paused: number = 0;
      private _seeked: number = 0;
      private _speed: number[] = [];

      setProperty(_key: string, _value: string | number | boolean): void {
        // no-op
      }
      playerConstructed(): void {
        // no-op
      }
      initialized(): void {
        this._initialized++;
      }
      play(_speed: number): void {
        this._played++;
      }
      seek(_time: Time): void {
        this._seeked++;
      }
      setSpeed(speed: number): void {
        this._speed.push(speed);
      }
      pause(): void {
        this._paused++;
      }
      setSubscriptions(): void {
        // no-op
      }
      close(): void {
        // no-op
      }
      recordDataProviderPerformance(): void {
        // no-op
      }
      recordDataProviderStall(): void {
        // no-op
      }
      recordPlaybackTime(_time: Time): void {
        // no-op
      }
      recordBytesReceived(_bytes: number): void {
        // no-op
      }
      recordUncachedRangeRequest(): void {
        // no-op
      }
      stats() {
        return {
          initialized: this._initialized,
          played: this._played,
          paused: this._paused,
          seeked: this._seeked,
          speed: this._speed,
        };
      }
      recordTimeToFirstMsgs(): void {
        // no-op
      }
      recordDataProviderInitializePerformance() {
        // no-op
      }
    }

    it("delegates to metricsCollector on actions", async () => {
      const provider = new TestProvider();
      provider.getMessages = async () => getMessagesResult;

      const metricsCollector = new TestMetricsCollector();
      const source = new RandomAccessPlayer(
        { name: "TestProvider", args: { provider }, children: [] },
        { ...playerOptions, metricsCollector },
      );
      expect(metricsCollector.stats()).toEqual({
        initialized: 0,
        played: 0,
        paused: 0,
        seeked: 0,
        speed: [],
      });
      const listener = jest.fn().mockImplementation(async (_msg) => {
        // just discard messages
      });

      // player should initialize even if the listener promise hasn't resolved yet
      let resolveListener: any;
      listener.mockImplementationOnce(async () => {
        return await new Promise((resolve) => {
          resolveListener = resolve;
        });
      });
      source.setListener(listener);
      await Promise.resolve();
      expect(metricsCollector.stats()).toEqual({
        initialized: 1,
        played: 0,
        paused: 0,
        seeked: 0,
        speed: [],
      });
      resolveListener();
      await Promise.resolve();
      expect(metricsCollector.stats()).toEqual({
        initialized: 1,
        played: 0,
        paused: 0,
        seeked: 0,
        speed: [],
      });

      source.startPlayback();
      source.startPlayback();
      expect(metricsCollector.stats()).toEqual({
        initialized: 1,
        played: 1,
        paused: 0,
        seeked: 0,
        speed: [],
      });
      source.seekPlayback({ sec: 10, nsec: 500 });
      source.seekPlayback({ sec: 11, nsec: 0 });
      expect(metricsCollector.stats()).toEqual({
        initialized: 1,
        played: 1,
        paused: 0,
        seeked: 2,
        speed: [],
      });
      source.pausePlayback();
      source.pausePlayback();
      expect(metricsCollector.stats()).toEqual({
        initialized: 1,
        played: 1,
        paused: 1,
        seeked: 2,
        speed: [],
      });
      source.setPlaybackSpeed(0.5);
      source.setPlaybackSpeed(1);
      expect(metricsCollector.stats()).toEqual({
        initialized: 1,
        played: 1,
        paused: 1,
        seeked: 2,
        speed: [0.5, 1],
      });
    });
  });

  it("seeks the player after starting", async () => {
    const provider = new TestProvider();
    provider.getMessages = jest.fn().mockImplementation(async () => getMessagesResult);
    const player = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    const store = new MessageStore(2);
    player.setSubscriptions([{ topic: "/foo/bar" }]);
    player.requestBackfill(); // We always get a `requestBackfill` after each `setSubscriptions`.
    player.setListener(store.add);
    const firstMessages = await store.done;
    expect(firstMessages).toEqual([
      expect.objectContaining({ activeData: undefined }), // isPlaying is set to false to begin
      expect.objectContaining({
        activeData: expect.objectContaining({ isPlaying: false, messages: [] }),
      }),
    ]);
    expect(provider.getMessages).toHaveBeenCalled();

    player.close();
  });

  it("does not seek until setListener is called to initialize the start and end time", async () => {
    const provider = new TestProvider();
    provider.getMessages = jest.fn().mockImplementation(async () => getMessagesResult);
    const player = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    const store = new MessageStore(2);
    player.setSubscriptions([{ topic: "/foo/bar" }]);
    player.requestBackfill(); // We always get a `requestBackfill` after each `setSubscriptions`.

    player.seekPlayback({ sec: 10, nsec: 0 });
    expect(provider.getMessages).not.toHaveBeenCalled();

    player.setListener(store.add);
    await Promise.resolve();
    player.seekPlayback({ sec: 10, nsec: 0 });
    expect(provider.getMessages).toHaveBeenCalled();

    player.close();
  });

  it("keeps currentTime reference equality if current time does not change", async () => {
    const provider = new TestProvider();
    provider.getMessages = jest.fn().mockImplementation(async () => getMessagesResult);
    const player = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );
    const store = new MessageStore(3);
    player.setListener(store.add);
    await Promise.resolve();

    player.setPlaybackSpeed(1);

    const messages = await store.done;
    expect(messages[1]?.activeData?.currentTime).toEqual({ sec: 10, nsec: 0 });
    expect(messages[1]?.activeData?.currentTime).toBe(messages[2]?.activeData?.currentTime);

    player.close();
  });

  it("requests messages according to the requested formats", async () => {
    expect.assertions(1);
    const provider = new TestProvider({
      topics: [
        { name: "/parsed_topic", datatype: "dummy" },
        { name: "/parsed_and_binary_topic", datatype: "dummy" },
        { name: "/only_binary_topic", datatype: "dummy" },
      ],
    });
    const source = new RandomAccessPlayer(
      { name: "TestProvider", args: { provider }, children: [] },
      playerOptions,
    );

    provider.getMessages = async (
      _start: Time,
      _end: Time,
      topics: GetMessagesTopics,
    ): Promise<GetMessagesResult> => {
      expect(topics).toEqual({
        parsedMessages: ["/parsed_topic", "/parsed_and_binary_topic"],
      });
      return getMessagesResult;
    };

    const store = new MessageStore(2);
    source.setListener(store.add);
    source.setSubscriptions([
      { topic: "/unknown_topic" }, // Shouldn't appear in getMessages at all!
      { topic: "/parsed_topic" },
      { topic: "/parsed_and_binary_topic" },
    ]);
    await store.done;
  });

  describe("hasCachedRange", () => {
    it("handles an empty progress range", async () => {
      const provider = new TestProvider({
        topics: [{ name: "/fallback_parsed", datatype: "dummy" }],
      });
      const player = new RandomAccessPlayer(
        { name: "TestProvider", args: { provider }, children: [] },
        playerOptions,
      );
      player.setListener(async () => {
        // no-op
      });
      provider.extensionPoint?.progressCallback({});

      expect(player.hasCachedRange({ sec: 10, nsec: 0 }, { sec: 10, nsec: 0 })).toBe(false);
    });

    it("handles non-empty progress ranges", async () => {
      const provider = new TestProvider({
        topics: [{ name: "/fallback_parsed", datatype: "dummy" }],
      });
      const player = new RandomAccessPlayer(
        { name: "TestProvider", args: { provider }, children: [] },
        playerOptions,
      );
      player.setListener(async () => {});
      await Promise.resolve();

      // Provider start/end is 10s/100s. Load from 55s to 100s.
      provider.extensionPoint?.progressCallback({
        fullyLoadedFractionRanges: [{ start: 0.5, end: 1.0 }],
      });

      expect(player.hasCachedRange({ sec: 0, nsec: 0 }, { sec: 0, nsec: 1 })).toBe(false);
      expect(player.hasCachedRange({ sec: 0, nsec: 0 }, { sec: 100, nsec: 0 })).toBe(false);

      expect(player.hasCachedRange({ sec: 50, nsec: 0 }, { sec: 95, nsec: 0 })).toBe(false);
      expect(player.hasCachedRange({ sec: 55, nsec: 0 }, { sec: 95, nsec: 0 })).toBe(true);
      expect(player.hasCachedRange({ sec: 55, nsec: 0 }, { sec: 100, nsec: 0 })).toBe(true);
      expect(player.hasCachedRange({ sec: 90, nsec: 0 }, { sec: 101, nsec: 0 })).toBe(false);
    });
  });
});
