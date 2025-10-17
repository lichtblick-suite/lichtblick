/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { signal } from "@lichtblick/den/async";
import { fromSec } from "@lichtblick/rostime";
import { PLAYER_CAPABILITIES } from "@lichtblick/suite-base/players/constants";
import { MessageEvent, PlayerPresence, PlayerState } from "@lichtblick/suite-base/players/types";
import * as highFrequencyUtils from "@lichtblick/suite-base/players/utils/isTopicHighFrequency";
import { mockTopicSelection } from "@lichtblick/suite-base/test/mocks/mockTopicSelection";

import {
  GetBackfillMessagesArgs,
  IDeserializedIterableSource,
  Initialization,
  IteratorResult,
  MessageIteratorArgs,
} from "./IIterableSource";
import { IterablePlayer } from "./IterablePlayer";

class TestSource implements IDeserializedIterableSource {
  public readonly sourceType = "deserialized";

  public async initialize(): Promise<Initialization> {
    return {
      start: { sec: 0, nsec: 0 },
      end: { sec: 1, nsec: 0 },
      topics: [],
      topicStats: new Map(),
      profile: undefined,
      alerts: [],
      datatypes: new Map(),
      publishersByTopic: new Map(),
      metadata: [{ name: "metadata1", metadata: { key: "value" } }],
    };
  }

  public async *messageIterator(
    _args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {}

  public async getBackfillMessages(_args: GetBackfillMessagesArgs): Promise<MessageEvent[]> {
    return [];
  }
}

type PlayerStateWithoutPlayerId = Omit<PlayerState, "playerId">;

// Testing class used to keep track of expected number of state transitions
class PlayerStateStore {
  public done: Promise<PlayerStateWithoutPlayerId[]>;

  #playerStates: PlayerStateWithoutPlayerId[] = [];
  #expected: number;
  #resolve: (arg0: PlayerStateWithoutPlayerId[]) => void = () => {
    // no-op
  };

  /**
   * @param expected - number of state transitions to be listened to before done is resolved
   */
  public constructor(expected: number) {
    this.#expected = expected;
    this.done = new Promise((resolve) => {
      this.#resolve = resolve;
    });
  }

  // when add is hooked up to the listener each state will be added to the playerStates array
  // when the playerState length reaches the expected number of transitions it will resolve the promise
  // if it exceeds it will throw an error and break the test
  public async add(state: PlayerState): Promise<void> {
    const { playerId: _playerId, ...rest } = state;
    this.#playerStates.push(rest);
    if (this.#playerStates.length === this.#expected) {
      this.#resolve(this.#playerStates);
    }
    if (this.#playerStates.length > this.#expected) {
      const error = new Error(
        `Expected: ${this.#expected} messages, received: ${this.#playerStates.length}`,
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
    this.#expected = expected;
    this.#playerStates = [];
    this.done = new Promise((resolve) => {
      this.#resolve = resolve;
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
    player.setListener(async (state) => {
      await store.add(state);
    });
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
      alerts: [],
      capabilities: [PLAYER_CAPABILITIES.setSpeed, PLAYER_CAPABILITIES.playbackControl],
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
      { ...baseState, activeData: undefined },
      // start delay
      {
        ...baseState,
        presence: PlayerPresence.PRESENT,
      },
      // initial play
      {
        ...baseState,
        presence: PlayerPresence.PRESENT,
        activeData: {
          ...baseState.activeData,
          currentTime: { sec: 0, nsec: 99000000 },
        },
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
    await player.isClosed;
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
    player.setListener(async (state) => {
      await store.add(state);
    });

    // Wait for initial setup
    await store.done;

    // Reset store to get state from the seeks
    store.reset(2);

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
      alerts: [],
      capabilities: [PLAYER_CAPABILITIES.setSpeed, PLAYER_CAPABILITIES.playbackControl],
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
    expect(playerStates).toEqual([withMessages, baseState]);

    player.close();
    await player.isClosed;
  });

  it("sets buffering presence when backfill takes too long", async () => {
    const source = new TestSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
      sourceId: "test",
    });
    const store = new PlayerStateStore(4);
    player.setSubscriptions([{ topic: "foo" }]);
    player.setListener(async (state) => {
      await store.add(state);
    });

    // Wait for initial setup
    await store.done;

    // Reset store to get state from the seeks
    store.reset(3);

    // replace the message iterator with our own implementation
    source.getBackfillMessages = async function () {
      mockDateNow = jest.spyOn(Date, "now").mockReturnValue(1);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      mockDateNow = jest.spyOn(Date, "now").mockReturnValue(2);
      return [];
    };

    // starts a seek backfill
    player.seekPlayback({ sec: 0, nsec: 0 });

    const playerStates = await store.done;

    const baseState: PlayerStateWithoutPlayerId = {
      activeData: {
        currentTime: { sec: 0, nsec: 0 },
        startTime: { sec: 0, nsec: 0 },
        endTime: { sec: 1, nsec: 0 },
        datatypes: new Map(),
        isPlaying: false,
        lastSeekTime: 2,
        messages: [],
        totalBytesReceived: 0,
        speed: 1.0,
        topics: [],
        topicStats: new Map(),
        publishedTopics: new Map<string, Set<string>>(),
      },
      alerts: [],
      capabilities: [PLAYER_CAPABILITIES.setSpeed, PLAYER_CAPABILITIES.playbackControl],
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

    const bufferingState: PlayerStateWithoutPlayerId = {
      ...baseState,
      presence: PlayerPresence.BUFFERING,
      activeData: {
        ...baseState.activeData!,
        lastSeekTime: 0,
      },
    };

    // The first seek is interrupted by the second seek.
    // The state order:
    // 1. a state update completing the second seek
    // 1. a state update for moving to idle
    expect(playerStates).toEqual([bufferingState, baseState, baseState]);

    player.close();
    await player.isClosed;
  });

  it("startPlayback emits when seek-backfill state is active", async () => {
    const source = new TestSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
      sourceId: "test",
    });
    const store = new PlayerStateStore(4);
    player.setSubscriptions([{ topic: "foo" }]);
    player.setListener(async (state) => {
      await store.add(state);
    });

    // Wait for initial setup
    await store.done;

    const origMsgIterator = source.messageIterator.bind(source);
    source.messageIterator = async function* messageIterator(
      _args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      source.messageIterator = origMsgIterator;

      yield {
        type: "message-event",
        msgEvent: {
          topic: "foo",
          receiveTime: { sec: 0, nsec: 99000001 },
          message: undefined,
          sizeInBytes: 0,
          schemaName: "foo",
        },
      };
    };

    const backfillStarted = signal();

    let resolveBackfill: (value?: unknown) => void = () => {};
    const backfillPromise = new Promise((resolve) => {
      resolveBackfill = resolve;
    });
    // replace the message iterator with our own implementation
    // This implementation performs a seekPlayback during backfill.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalMethod = source.getBackfillMessages;
    source.getBackfillMessages = async function () {
      source.getBackfillMessages = originalMethod;
      backfillStarted.resolve();
      await backfillPromise;
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

    // Reset store to get state from the seeks
    store.reset(1);
    const getIsPlaying = (state: PlayerStateWithoutPlayerId) => state.activeData?.isPlaying;
    // starts a seek backfill does not emit unless it takes too long or it finishes
    player.seekPlayback({ sec: 1, nsec: 0 });
    await backfillStarted;
    // emits state
    let playerStates = await store.done;
    expect(playerStates.map(getIsPlaying)).toEqual([false]);
    store.reset(1);
    player.startPlayback();

    playerStates = await store.done;
    expect(playerStates.map(getIsPlaying)).toEqual([true]);
    // emits state when backfill is finished
    store.reset(1);
    resolveBackfill();

    playerStates = await store.done;
    expect(playerStates.map(getIsPlaying)).toEqual([true]);

    player.close();
    await player.isClosed;
  });

  it("pausePlayback emits when seek-backfill state is active", async () => {
    const source = new TestSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
      sourceId: "test",
    });
    const store = new PlayerStateStore(4);
    player.setSubscriptions([{ topic: "foo" }]);
    player.setListener(async (state) => {
      await store.add(state);
    });

    // Wait for initial setup
    await store.done;
    // Reset store to get state from the seeks

    const origMsgIterator = source.messageIterator.bind(source);
    source.messageIterator = async function* messageIterator(
      _args: MessageIteratorArgs,
    ): AsyncIterableIterator<Readonly<IteratorResult>> {
      source.messageIterator = origMsgIterator;

      yield {
        type: "message-event",
        msgEvent: {
          topic: "foo",
          receiveTime: { sec: 0, nsec: 99000001 },
          message: undefined,
          sizeInBytes: 0,
          schemaName: "foo",
        },
      };
    };

    let resolveBackfill: (value?: unknown) => void = () => {};
    const backfillPromise = new Promise((resolve) => {
      resolveBackfill = resolve;
    });

    const backfillStarted = signal();
    // replace the message iterator with our own implementation
    // This implementation performs a seekPlayback during backfill.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalMethod = source.getBackfillMessages;
    source.getBackfillMessages = async function () {
      source.getBackfillMessages = originalMethod;
      backfillStarted.resolve();
      await backfillPromise;
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
    store.reset(1);
    // emit state
    player.startPlayback();

    const getIsPlaying = (state: PlayerStateWithoutPlayerId) => state.activeData?.isPlaying;
    let playerStates = await store.done;
    expect(playerStates.map(getIsPlaying)).toEqual([true]);

    store.reset(1);
    // starts a seek backfill does not emit unless it takes too long or it finishes
    player.seekPlayback({ sec: 1, nsec: 0 });
    await backfillStarted;

    playerStates = await store.done;
    expect(playerStates.map(getIsPlaying)).toEqual([true]);

    store.reset(1);
    // emits state
    player.pausePlayback();
    // emits state when backfill is finished

    playerStates = await store.done;
    expect(playerStates.map(getIsPlaying)).toEqual([false]);
    store.reset(2);

    resolveBackfill();

    playerStates = await store.done;
    expect(playerStates.map(getIsPlaying)).toEqual([false, false]);

    player.close();

    await player.isClosed;
  });

  it("provides error message for inconsistent topic datatypes", async () => {
    class DuplicateTopicsSource implements IDeserializedIterableSource {
      public readonly sourceType = "deserialized";
      public async initialize(): Promise<Initialization> {
        return {
          start: { sec: 0, nsec: 0 },
          end: { sec: 1, nsec: 0 },
          topics: [
            { name: "A", schemaName: "B" },
            { name: "A", schemaName: "C" },
          ],
          topicStats: new Map(),
          profile: undefined,
          alerts: [],
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
    player.setListener(async (state) => {
      await store.add(state);
    });
    const playerStates = await store.done;
    expect(_.last(playerStates)!.alerts).toEqual([
      {
        message: "Inconsistent datatype for topic: A",
        severity: "warn",
        tip: "Topic A has messages with multiple datatypes: B, C. This may result in errors during visualization.",
      },
    ]);
    (console.warn as jest.Mock).mockClear();
  });

  it("supports seek request during initialization", async () => {
    const source = new TestSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
      sourceId: "test",
    });
    const store = new PlayerStateStore(4);
    player.setSubscriptions([{ topic: "foo" }]);
    player.setListener(async (state) => {
      await store.add(state);
    });

    // starts a seek backfill
    player.seekPlayback(fromSec(0.5));

    const baseState: PlayerStateWithoutPlayerId = {
      activeData: {
        currentTime: fromSec(0.5),
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
      alerts: [],
      capabilities: [PLAYER_CAPABILITIES.setSpeed, PLAYER_CAPABILITIES.playbackControl],
      profile: undefined,
      presence: PlayerPresence.PRESENT,
      progress: {
        fullyLoadedFractionRanges: [{ start: 0.500_000_001, end: 1 }],
        messageCache: undefined,
      },
      urlState: {
        sourceId: "test",
        parameters: undefined,
      },
      name: undefined,
    };

    const playerStates = await store.done;
    expect(playerStates).toEqual([
      {
        ...baseState,
        activeData: undefined,
        presence: PlayerPresence.INITIALIZING,
        progress: {},
      },
      { ...baseState, progress: {} },
      { ...baseState, progress: {} },
      baseState,
    ]);

    player.close();
    await player.isClosed;
  });

  it("should detect high frequency topics during initialization", async () => {
    class HighFrequencyTopicSource implements IDeserializedIterableSource {
      public readonly sourceType = "deserialized";
      public async initialize(): Promise<Initialization> {
        const topicStats = new Map();
        topicStats.set("high-freq-topic", {
          numMessages: 6000, // High message count
          firstMessageTime: { sec: 0, nsec: 0 },
          lastMessageTime: { sec: 1, nsec: 0 },
        });

        return {
          start: { sec: 0, nsec: 0 },
          end: { sec: 1, nsec: 0 },
          topics: [{ name: "high-freq-topic", schemaName: "std_msgs/String" }],
          topicStats,
          profile: undefined,
          alerts: [],
          datatypes: new Map(),
          publishersByTopic: new Map(),
        };
      }

      public async *messageIterator() {}
      public async getBackfillMessages() {
        return [];
      }
    }

    const source = new HighFrequencyTopicSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
      sourceId: "test",
    });

    const store = new PlayerStateStore(4);
    player.setListener(async (state) => {
      await store.add(state);
    });

    const playerStates = await store.done;
    expect(_.last(playerStates)!.alerts).toEqual([
      {
        severity: "warn",
        message: "High frequency topics detected",
        error: expect.any(Error),
      },
    ]);

    player.close();
    await player.isClosed;

    (console.warn as jest.Mock).mockClear();
  });

  it("should only call isTopicHighFrequency once even with multiple high frequency topics", async () => {
    const isTopicHighFrequencySpy = jest.spyOn(highFrequencyUtils, "isTopicHighFrequency");

    class MultiHighFreqTopicsSource implements IDeserializedIterableSource {
      public readonly sourceType = "deserialized";
      public async initialize(): Promise<Initialization> {
        const topicStats = new Map();
        // Add multiple high frequency topics
        topicStats.set("high-freq-topic-1", {
          numMessages: 6000,
          firstMessageTime: { sec: 0, nsec: 0 },
          lastMessageTime: { sec: 1, nsec: 0 },
        });
        topicStats.set("high-freq-topic-2", {
          numMessages: 7000,
          firstMessageTime: { sec: 0, nsec: 0 },
          lastMessageTime: { sec: 1, nsec: 0 },
        });

        return {
          start: { sec: 0, nsec: 0 },
          end: { sec: 1, nsec: 0 },
          topics: [
            { name: "high-freq-topic-1", schemaName: "std_msgs/String" },
            { name: "high-freq-topic-2", schemaName: "std_msgs/String" },
          ],
          topicStats,
          profile: undefined,
          alerts: [],
          datatypes: new Map(),
          publishersByTopic: new Map(),
        };
      }

      public async *messageIterator() {}
      public async getBackfillMessages() {
        return [];
      }
    }

    const source = new MultiHighFreqTopicsSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
      sourceId: "test",
    });

    const store = new PlayerStateStore(4);
    player.setListener(async (state) => {
      await store.add(state);
    });

    await store.done;

    expect(isTopicHighFrequencySpy).toHaveBeenCalledTimes(1);

    player.close();
    await player.isClosed;

    isTopicHighFrequencySpy.mockRestore();

    (console.warn as jest.Mock).mockClear();
  });

  it("should start a new iterator mid-tick when old iterator finishes", async () => {
    const source = new TestSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
      sourceId: "test",
    });
    const store = new PlayerStateStore(4);
    player.setListener(async (state) => {
      await store.add(state);
    });

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
        type: "message-event",
        msgEvent: {
          topic: "foo",
          receiveTime: { sec: 0, nsec: 99000001 },
          message: undefined,
          sizeInBytes: 0,
          schemaName: "foo",
        },
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
    await player.isClosed;
  });

  it("should not override seek-backfill state when setPlayback speed is called", async () => {
    const source = new TestSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
      sourceId: "test",
    });
    const store = new PlayerStateStore(4);
    player.setListener(async (state) => {
      await store.add(state);
    });
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
        type: "message-event",
        msgEvent: {
          topic: "foo",
          receiveTime: { sec: 0, nsec: 99000001 },
          message: undefined,
          sizeInBytes: 0,
          schemaName: "foo",
        },
      };
    };

    store.reset(1);

    {
      // if the playback iterator is undefined it will throw an invariant error
      expect(() => {
        player.startPlayback();
      }).not.toThrow();
      await store.done;
    }

    player.close();
    await player.isClosed;
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
    player.setListener(async (state) => {
      await store.add(state);
    });

    // Wait for initial setup
    await store.done;

    // Call set subscriptions and add a new topic
    store.reset(2);
    player.setSubscriptions([{ topic: "foo" }, { topic: "bar" }]);

    await store.done;

    expect(messageIteratorSpy.mock.calls).toEqual([
      [
        {
          start: { sec: 0, nsec: 0 },
          end: { sec: 1, nsec: 0 },
          topics: mockTopicSelection("foo"),
          consumptionType: "partial",
        },
      ],
      [
        {
          start: { sec: 0, nsec: 99000001 },
          end: { sec: 1, nsec: 0 },
          topics: mockTopicSelection("bar", "foo"),
          consumptionType: "partial",
        },
      ],
    ]);

    player.close();
    await player.isClosed;
  });

  it("should allow changing subscriptions when player in start-play state", async () => {
    const source = new TestSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
      sourceId: "test",
    });

    const messageIteratorSpy = jest.spyOn(source, "messageIterator");

    const store = new PlayerStateStore(3);
    player.setListener(async (state) => {
      await store.add(state);
    });
    // Wait for player to be in start-play state
    await store.done;
    player.setSubscriptions([{ topic: "foo" }]);

    // Wait for player's initial setup to complete (seek-backfill + idle)
    store.reset(2);
    await store.done;

    expect(messageIteratorSpy.mock.calls).toEqual([
      [
        {
          start: { sec: 0, nsec: 99000001 },
          end: { sec: 1, nsec: 0 },
          topics: mockTopicSelection("foo"),
          consumptionType: "partial",
        },
      ],
    ]);

    player.close();
    await player.isClosed;
  });

  it("should return the correct frozen metadata", async () => {
    const source = new TestSource();
    const player = new IterablePlayer({
      source,
      enablePreload: false,
      sourceId: "test",
    });

    const metadata = player.getMetadata();

    // At first, metadata is empty because it's initialized in an async way.
    expect(metadata.length).toBe(0);

    // Setup store to player update to be in start-play state
    const store = new PlayerStateStore(4);
    player.setListener(async (state) => {
      await store.add(state);
    });
    // Wait for player to be in start-play state
    await store.done;

    const metadataInitialized = player.getMetadata();
    expect(metadataInitialized.length).toBe(1);
    expect(() => {
      // @ts-expect-error because the array is type as readonly
      metadataInitialized.pop();
    }).toThrow();
  });

  describe("getBatchIterator", () => {
    it("should return undefined when messageRangeSource is not available", () => {
      const source = new TestSource();
      const player = new IterablePlayer({
        source,
        enablePreload: false,
        sourceId: "test",
      });

      // Before initialization, messageRangeSource should be undefined
      const iterator = player.getBatchIterator("test_topic");
      expect(iterator).toBeUndefined();
    });

    it("should create correct topic selection and call messageIterator", async () => {
      const source = new TestSource();

      // Mock the messageIterator method to track calls
      const mockMessageIterator = jest.fn().mockImplementation(async function* () {
        yield {
          type: "message-event",
          msgEvent: {
            topic: "test_topic",
            receiveTime: { sec: 1, nsec: 0 },
            message: { data: "test" },
            sizeInBytes: 100,
            schemaName: "test_schema",
          },
        };
      });

      source.messageIterator = mockMessageIterator;

      const player = new IterablePlayer({
        source,
        enablePreload: false,
        sourceId: "test",
      });

      // Wait for initialization
      const store = new PlayerStateStore(4);
      player.setListener(async (state) => {
        await store.add(state);
      });
      await store.done;

      // Now getBatchIterator should work
      const iterator = player.getBatchIterator("test_topic");
      expect(iterator).toBeDefined();

      // Consume one item from the iterator to verify it works
      expect(iterator).toBeDefined();
      const result = await iterator!.next();
      expect(result.done).toBe(false);
      // Verify we got a message event
      expect((result as any).value.type).toBe("message-event");

      // Verify that messageIterator was called with correct parameters
      expect(mockMessageIterator).toHaveBeenCalledWith({
        topics: new Map([["test_topic", { topic: "test_topic" }]]),
        consumptionType: "full",
      });
    });

    it("should handle multiple topics correctly", async () => {
      const source = new TestSource();

      const mockMessageIterator = jest.fn().mockImplementation(async function* () {
        yield {
          type: "message-event",
          msgEvent: {
            topic: "topic1",
            receiveTime: { sec: 1, nsec: 0 },
            message: { data: "test1" },
            sizeInBytes: 100,
            schemaName: "test_schema",
          },
        };
        yield {
          type: "message-event",
          msgEvent: {
            topic: "topic2",
            receiveTime: { sec: 2, nsec: 0 },
            message: { data: "test2" },
            sizeInBytes: 100,
            schemaName: "test_schema",
          },
        };
      });

      source.messageIterator = mockMessageIterator;

      const player = new IterablePlayer({
        source,
        enablePreload: false,
        sourceId: "test",
      });

      // Wait for initialization
      const store = new PlayerStateStore(4);
      player.setListener(async (state) => {
        await store.add(state);
      });
      await store.done;

      // Test getBatchIterator for topic1
      const iterator1 = player.getBatchIterator("topic1");
      expect(iterator1).toBeDefined();

      // Test getBatchIterator for topic2
      const iterator2 = player.getBatchIterator("topic2");
      expect(iterator2).toBeDefined();

      // Verify calls with different topics
      expect(mockMessageIterator).toHaveBeenCalledWith({
        topics: new Map([["topic1", { topic: "topic1" }]]),
        consumptionType: "full",
      });

      expect(mockMessageIterator).toHaveBeenCalledWith({
        topics: new Map([["topic2", { topic: "topic2" }]]),
        consumptionType: "full",
      });
    });

    it("should handle iterator that yields different result types", async () => {
      const source = new TestSource();

      const mockMessageIterator = jest.fn().mockImplementation(async function* () {
        yield {
          type: "message-event",
          msgEvent: {
            topic: "test_topic",
            receiveTime: { sec: 1, nsec: 0 },
            message: { data: "test" },
            sizeInBytes: 100,
            schemaName: "test_schema",
          },
        };
        yield {
          type: "alert",
          connectionId: 1,
          alert: { severity: "info", message: "test alert" },
        };
        yield {
          type: "stamp",
          stamp: { sec: 1, nsec: 500000000 },
        };
      });

      source.messageIterator = mockMessageIterator;

      const player = new IterablePlayer({
        source,
        enablePreload: false,
        sourceId: "test",
      });

      // Wait for initialization
      const store = new PlayerStateStore(4);
      player.setListener(async (state) => {
        await store.add(state);
      });
      await store.done;

      const iterator = player.getBatchIterator("test_topic");
      expect(iterator).toBeDefined();

      const results = [];
      for await (const result of iterator!) {
        results.push(result);
      }

      expect(results).toHaveLength(3);
      expect(results[0]?.type).toBe("message-event");
      expect(results[1]?.type).toBe("alert");
      expect(results[2]?.type).toBe("stamp");
    });

    it("should handle empty iterator", async () => {
      const source = new TestSource();

      const mockMessageIterator = jest.fn().mockImplementation(async function* () {
        // Empty iterator
      });

      source.messageIterator = mockMessageIterator;

      const player = new IterablePlayer({
        source,
        enablePreload: false,
        sourceId: "test",
      });

      // Wait for initialization
      const store = new PlayerStateStore(4);
      player.setListener(async (state) => {
        await store.add(state);
      });
      await store.done;

      const iterator = player.getBatchIterator("test_topic");
      expect(iterator).toBeDefined();

      const result = await iterator!.next();
      expect(result.done).toBe(true);
    });

    it("should handle iterator errors gracefully", async () => {
      const source = new TestSource();

      const mockMessageIterator = jest.fn().mockImplementation(async function* () {
        yield {
          type: "message-event",
          msgEvent: {
            topic: "test_topic",
            receiveTime: { sec: 1, nsec: 0 },
            message: { data: "test" },
            sizeInBytes: 100,
            schemaName: "test_schema",
          },
        };
        throw new Error("Iterator error");
      });

      source.messageIterator = mockMessageIterator;

      const player = new IterablePlayer({
        source,
        enablePreload: false,
        sourceId: "test",
      });

      // Wait for initialization
      const store = new PlayerStateStore(4);
      player.setListener(async (state) => {
        await store.add(state);
      });
      await store.done;

      const iterator = player.getBatchIterator("test_topic");
      expect(iterator).toBeDefined();

      // Should get first message
      const result1 = await iterator!.next();
      expect(result1.done).toBe(false);
      expect(result1.value.type).toBe("message-event");

      // Should throw on second call
      await expect(iterator!.next()).rejects.toThrow("Iterator error");
    });

    it("should use full consumption type", async () => {
      const source = new TestSource();

      const mockMessageIterator = jest.fn().mockImplementation(async function* () {
        yield {
          type: "message-event",
          msgEvent: {
            topic: "test_topic",
            receiveTime: { sec: 1, nsec: 0 },
            message: { data: "test" },
            sizeInBytes: 100,
            schemaName: "test_schema",
          },
        };
      });

      source.messageIterator = mockMessageIterator;

      const player = new IterablePlayer({
        source,
        enablePreload: false,
        sourceId: "test",
      });

      // Wait for initialization
      const store = new PlayerStateStore(4);
      player.setListener(async (state) => {
        await store.add(state);
      });
      await store.done;

      player.getBatchIterator("test_topic");

      // Verify that consumptionType is "full"
      expect(mockMessageIterator).toHaveBeenCalledWith({
        topics: expect.any(Map),
        consumptionType: "full",
      });
    });
  });
});
