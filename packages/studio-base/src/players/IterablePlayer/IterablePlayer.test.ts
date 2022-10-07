/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { last } from "lodash";

import {
  MessageEvent,
  PlayerCapabilities,
  PlayerPresence,
  PlayerState,
} from "@foxglove/studio-base/players/types";

import {
  IIterableSource,
  Initalization,
  MessageIteratorArgs,
  IteratorResult,
  GetBackfillMessagesArgs,
} from "./IIterableSource";
import { IterablePlayer } from "./IterablePlayer";

class TestSource implements IIterableSource {
  public async initialize(): Promise<Initalization> {
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

  public async *messageIterator(
    _args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {}

  public async getBackfillMessages(
    _args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<unknown>[]> {
    return [];
  }
}

type PlayerStateWithoutPlayerId = Omit<PlayerState, "playerId">;

// Testing class used to keep track of expected number of state transitions
class PlayerStateStore {
  public done: Promise<PlayerStateWithoutPlayerId[]>;

  private playerStates: PlayerStateWithoutPlayerId[] = [];
  private expected: number;
  private resolve: (arg0: PlayerStateWithoutPlayerId[]) => void = () => {
    // no-op
  };

  /**
   * @param expected - number of state transitions to be listened to before done is resolved
   */
  public constructor(expected: number) {
    this.expected = expected;
    this.done = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  // when add is hooked up to the listener each state will be added to the playerStates array
  // when the playerState length reaches the expected number of transitions it will resolve the promise
  // if it exceeds it will throw an error and break the test
  public async add(state: PlayerState): Promise<void> {
    const { playerId: _playerId, ...rest } = state;
    this.playerStates.push(rest);
    if (this.playerStates.length === this.expected) {
      this.resolve(this.playerStates);
    }
    if (this.playerStates.length > this.expected) {
      const error = new Error(
        `Expected: ${this.expected} messages, received: ${this.playerStates.length}`,
      );
      this.done = Promise.reject(error);
      throw error;
    }
  }

  /**
   * reset allows for reinitializing without needing to create and hook up a new instance
   * @param expected - number of state transitions to be listened to before done is resolved
   */
  public reset(expected: number): void {
    this.expected = expected;
    this.playerStates = [];
    this.done = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }
}

describe("IterablePlayer", () => {
  let mockDateNow: jest.SpyInstance<number, []>;
  beforeEach(() => {
    mockDateNow = jest.spyOn(Date, "now").mockReturnValue(0);
  });
  afterEach(async () => {
    mockDateNow.mockRestore();
  });

  it("calls listener with initial player states", async () => {
    const source = new TestSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
      sourceId: "test",
    });
    const store = new PlayerStateStore(4);
    player.setListener(async (state) => await store.add(state));
    const playerStates = await store.done;

    const baseState: PlayerStateWithoutPlayerId = {
      activeData: {
        currentTime: { sec: 0, nsec: 0 },
        startTime: { sec: 0, nsec: 0 },
        endTime: { sec: 1, nsec: 0 },
        datatypes: new Map(),
        isPlaying: false,
        lastSeekTime: 0,
        messages: [],
        totalBytesReceived: 0,
        speed: 1.0,
        topics: [],
        topicStats: new Map(),
        publishedTopics: new Map<string, Set<string>>(),
      },
      problems: [],
      capabilities: [PlayerCapabilities.setSpeed, PlayerCapabilities.playbackControl],
      profile: undefined,
      presence: PlayerPresence.INITIALIZING,
      progress: {},
      urlState: {
        sourceId: "test",
        parameters: undefined,
      },
      name: undefined,
    };

    expect(playerStates).toEqual([
      // before initialize
      { ...baseState, activeData: { ...baseState.activeData, endTime: { sec: 0, nsec: 0 } } },
      // start delay
      {
        ...baseState,
        presence: PlayerPresence.PRESENT,
      },
      // startPlay
      {
        ...baseState,
        presence: PlayerPresence.PRESENT,
        activeData: { ...baseState.activeData, currentTime: { sec: 0, nsec: 99000000 } },
      },
      // idle
      {
        ...baseState,
        presence: PlayerPresence.PRESENT,
        activeData: { ...baseState.activeData, currentTime: { sec: 0, nsec: 99000000 } },
        progress: {
          fullyLoadedFractionRanges: [{ start: 0, end: 0 }],
          messageCache: undefined,
        },
      },
    ]);

    player.close();
  });

  it("provides error message for inconsistent topic datatypes", async () => {
    class DuplicateTopicsSource implements IIterableSource {
      public async initialize(): Promise<Initalization> {
        return {
          start: { sec: 0, nsec: 0 },
          end: { sec: 1, nsec: 0 },
          topics: [
            { name: "A", schemaName: "B" },
            { name: "A", schemaName: "C" },
          ],
          topicStats: new Map(),
          profile: undefined,
          problems: [],
          datatypes: new Map([
            ["B", { name: "B", definitions: [] }],
            ["C", { name: "C", definitions: [] }],
          ]),
          publishersByTopic: new Map(),
        };
      }

      public async *messageIterator() {}

      public async getBackfillMessages() {
        return [];
      }
    }

    const source = new DuplicateTopicsSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
      sourceId: "test",
    });
    const store = new PlayerStateStore(4);
    player.setListener(async (state) => await store.add(state));
    const playerStates = await store.done;
    expect(last(playerStates)!.problems).toEqual([
      {
        message: "Inconsistent datatype for topic: A",
        severity: "warn",
        tip: "Topic A has messages with multiple datatypes: B, C. This may result in errors during visualization.",
      },
    ]);
    (console.warn as jest.Mock).mockClear();
  });

  it("when seeking during a seek backfill, start another seek after the current one exits", async () => {
    const source = new TestSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
      sourceId: "test",
    });
    const store = new PlayerStateStore(4);
    player.setSubscriptions([{ topic: "foo" }]);
    player.setListener(async (state) => await store.add(state));

    // Wait for initial setup
    await store.done;

    // Reset store to get state from the seeks
    store.reset(3);

    // replace the message iterator with our own implementation
    // This implementation performs a seekPlayback during backfill.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalMethod = source.getBackfillMessages;
    source.getBackfillMessages = async function () {
      // Set a new backfill method and initiate another seek
      source.getBackfillMessages = async function () {
        source.getBackfillMessages = originalMethod;
        return [
          {
            topic: "foo",
            receiveTime: { sec: 0, nsec: 1 },
            message: undefined,
            sizeInBytes: 0,
            schemaName: "foo",
          },
        ];
      };

      player.seekPlayback({ sec: 0, nsec: 1 });
      return [];
    };

    // starts a seek backfill
    player.seekPlayback({ sec: 0, nsec: 0 });

    const playerStates = await store.done;

    const baseState: PlayerStateWithoutPlayerId = {
      activeData: {
        currentTime: { sec: 0, nsec: 1 },
        startTime: { sec: 0, nsec: 0 },
        endTime: { sec: 1, nsec: 0 },
        datatypes: new Map(),
        isPlaying: false,
        lastSeekTime: 0,
        messages: [],
        totalBytesReceived: 0,
        speed: 1.0,
        topics: [],
        topicStats: new Map(),
        publishedTopics: new Map<string, Set<string>>(),
      },
      problems: [],
      capabilities: [PlayerCapabilities.setSpeed, PlayerCapabilities.playbackControl],
      profile: undefined,
      presence: PlayerPresence.PRESENT,
      progress: {
        fullyLoadedFractionRanges: [{ start: 0, end: 1 }],
        messageCache: undefined,
      },
      urlState: {
        sourceId: "test",
        parameters: undefined,
      },
      name: undefined,
    };

    const withMessages: PlayerStateWithoutPlayerId = {
      ...baseState,
      activeData: {
        ...baseState.activeData!,
        currentTime: { sec: 0, nsec: 1 },
        messages: [
          {
            message: undefined,
            receiveTime: { sec: 0, nsec: 1 },
            sizeInBytes: 0,
            topic: "foo",
            schemaName: "foo",
          },
        ],
      },
    };

    // The first seek is interrupted by the second seek.
    // The state order:
    // 1. a state update completing the second seek
    // 1. a state update for moving to idle
    expect(playerStates).toEqual([withMessages, baseState, baseState]);

    player.close();
  });

  it("should start a new iterator mid-tick when old iterator finishes", async () => {
    const source = new TestSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
      sourceId: "test",
    });
    const store = new PlayerStateStore(4);
    player.setListener(async (state) => await store.add(state));

    await store.done;

    // Replace the message iterator to produce 1 message (for the first tick), and then
    // set back to not producing any messages. Playback should handle this properly rather
    // than entering an infinite loop within a tick.
    const origMsgIterator = source.messageIterator.bind(source);
    source.messageIterator = async function* messageIterator(
      _args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      source.messageIterator = origMsgIterator;

      yield {
        msgEvent: {
          topic: "foo",
          receiveTime: { sec: 0, nsec: 99000001 },
          message: undefined,
          sizeInBytes: 0,
          schemaName: "foo",
        },
        problem: undefined,
        connectionId: undefined,
      };
    };

    // We only wait for 1 player state to test that tick did not enter an infinite loop
    store.reset(1);
    player.startPlayback();

    {
      const playerStates = await store.done;
      expect(playerStates.length).toEqual(1);
    }

    player.close();
  });
  it("should not override seek-backfill state when setPlayback speed is called", async () => {
    const source = new TestSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
      sourceId: "test",
    });
    const store = new PlayerStateStore(4);
    player.setListener(async (state) => await store.add(state));
    await store.done;

    player.seekPlayback({ sec: 0, nsec: 0 });
    player.setPlaybackSpeed(1);

    // // Replace the message iterator to produce 1 message (for the first tick), and then
    // // set back to not producing any messages
    const origMsgIterator = source.messageIterator.bind(source);
    source.messageIterator = async function* messageIterator(
      _args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      source.messageIterator = origMsgIterator;

      yield {
        msgEvent: {
          topic: "foo",
          receiveTime: { sec: 0, nsec: 99000001 },
          message: undefined,
          sizeInBytes: 0,
          schemaName: "foo",
        },
        problem: undefined,
        connectionId: undefined,
      };
    };

    store.reset(1);

    {
      // if the playback iterator is undefined it will throw an invariant error
      expect(() => player.startPlayback()).not.toThrowError();
      await store.done;
    }

    player.close();
  });

  it("should make a new message iterator when topic subscriptions change", async () => {
    const source = new TestSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
      sourceId: "test",
    });

    const messageIteratorSpy = jest.spyOn(source, "messageIterator");

    const store = new PlayerStateStore(4);
    player.setSubscriptions([{ topic: "foo" }]);
    player.setListener(async (state) => await store.add(state));

    // Wait for initial setup
    await store.done;

    // Call set subscriptions and add a new topic
    store.reset(3);
    player.setSubscriptions([{ topic: "foo" }, { topic: "bar" }]);

    await store.done;

    expect(messageIteratorSpy.mock.calls).toEqual([
      [
        {
          start: { sec: 0, nsec: 0 },
          end: { sec: 1, nsec: 0 },
          topics: ["foo"],
          consumptionType: "partial",
        },
      ],
      [
        {
          start: { sec: 0, nsec: 99000001 },
          end: { sec: 1, nsec: 0 },
          topics: ["bar", "foo"],
          consumptionType: "partial",
        },
      ],
    ]);

    player.close();
  });
});
