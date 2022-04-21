/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

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
  async initialize(): Promise<Initalization> {
    return {
      start: { sec: 0, nsec: 0 },
      end: { sec: 0, nsec: 0 },
      topics: [],
      topicStats: new Map(),
      problems: [],
      datatypes: new Map(),
      publishersByTopic: new Map(),
    };
  }

  async *messageIterator(_args: MessageIteratorArgs): AsyncIterator<Readonly<IteratorResult>> {}

  async getBackfillMessages(_args: GetBackfillMessagesArgs): Promise<MessageEvent<unknown>[]> {
    return [];
  }
}

type PlayerStateWithoutPlayerId = Omit<PlayerState, "playerId">;

class PlayerStateStore {
  done: Promise<PlayerStateWithoutPlayerId[]>;

  private playerStates: PlayerStateWithoutPlayerId[] = [];
  private expected: number;
  private resolve: (arg0: PlayerStateWithoutPlayerId[]) => void = () => {
    // no-op
  };

  constructor(expected: number) {
    this.expected = expected;
    this.done = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  async add(state: PlayerState): Promise<void> {
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

  reset(expected: number): void {
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
    });
    const store = new PlayerStateStore(4);
    player.setListener(async (state) => await store.add(state));
    const playerStates = await store.done;

    const baseState: PlayerStateWithoutPlayerId = {
      activeData: {
        currentTime: { sec: 0, nsec: 0 },
        startTime: { sec: 0, nsec: 0 },
        endTime: { sec: 0, nsec: 0 },
        datatypes: new Map(),
        isPlaying: false,
        lastSeekTime: 0,
        messages: [],
        totalBytesReceived: 0,
        messageOrder: "receiveTime",
        speed: 1.0,
        topics: [],
        topicStats: new Map(),
        publishedTopics: new Map<string, Set<string>>(),
      },
      problems: [],
      capabilities: [PlayerCapabilities.setSpeed, PlayerCapabilities.playbackControl],
      presence: PlayerPresence.INITIALIZING,
      progress: {},
      filePath: undefined,
      urlState: undefined,
      name: undefined,
    };

    expect(playerStates).toEqual([
      // before initialize
      baseState,
      // start delay
      baseState,
      // startPlay
      { ...baseState, presence: PlayerPresence.PRESENT },
      // idle
      { ...baseState, presence: PlayerPresence.PRESENT },
    ]);

    player.close();
  });

  it("when seeking during a seek backfill, start another seek after the current one exits", async () => {
    const source = new TestSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
    });
    const store = new PlayerStateStore(4);
    player.setSubscriptions([{ topic: "foo" }]);
    player.setListener(async (state) => await store.add(state));
    await store.done;

    store.reset(4);

    // replace the message iterator with our own implementation
    // This implementation performs a seekPlayback during backfill.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalMethod = source.getBackfillMessages;
    source.getBackfillMessages = async function () {
      source.getBackfillMessages = async function () {
        source.getBackfillMessages = originalMethod;
        return [
          {
            topic: "foo",
            receiveTime: { sec: 0, nsec: 1 },
            message: undefined,
            sizeInBytes: 0,
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
        currentTime: { sec: 0, nsec: 0 },
        startTime: { sec: 0, nsec: 0 },
        endTime: { sec: 0, nsec: 0 },
        datatypes: new Map(),
        isPlaying: false,
        lastSeekTime: 0,
        messages: [],
        totalBytesReceived: 0,
        messageOrder: "receiveTime",
        speed: 1.0,
        topics: [],
        topicStats: new Map(),
        publishedTopics: new Map<string, Set<string>>(),
      },
      problems: [],
      capabilities: [PlayerCapabilities.setSpeed, PlayerCapabilities.playbackControl],
      presence: PlayerPresence.PRESENT,
      progress: {},
      filePath: undefined,
      urlState: undefined,
      name: undefined,
    };

    const newSeekBase = {
      ...baseState,
      activeData: {
        ...baseState.activeData!,
        currentTime: { sec: 0, nsec: 1 },
      },
    };

    const withMessages: PlayerStateWithoutPlayerId = {
      ...newSeekBase,
      activeData: {
        ...newSeekBase.activeData,
        currentTime: { sec: 0, nsec: 1 },
        messages: [
          {
            message: undefined,
            receiveTime: { sec: 0, nsec: 1 },
            sizeInBytes: 0,
            topic: "foo",
          },
        ],
      },
    };

    // The first seek is interrupted by the second seek.
    // The state order:
    // 1. a state update with the currentTime to ack the seek
    // 2. a state update with the _new_ seek time to ack the second seek
    // 3. a state update with the messages from the new seek
    // 4. a state update from idle
    expect(playerStates).toEqual([baseState, newSeekBase, withMessages, newSeekBase]);

    player.close();
  });
});
