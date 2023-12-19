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

import { renderHook, act } from "@testing-library/react";
import { PropsWithChildren, useCallback, useState } from "react";
import { DeepPartial } from "ts-essentials";

import AppConfigurationContext from "@foxglove/studio-base/context/AppConfigurationContext";
import {
  Player,
  PlayerCapabilities,
  PlayerPresence,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import MockCurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider/MockCurrentLayoutProvider";
import delay from "@foxglove/studio-base/util/delay";
import { makeMockAppConfiguration } from "@foxglove/studio-base/util/makeMockAppConfiguration";

import { MessagePipelineProvider, useMessagePipeline, MessagePipelineContext } from ".";
import FakePlayer from "./FakePlayer";
import { MAX_PROMISE_TIMEOUT_TIME_MS } from "./pauseFrameForPromise";

jest.setTimeout(MAX_PROMISE_TIMEOUT_TIME_MS * 3);

// We require two state updates for each player emit() to take effect, for unknown reasons
async function doubleAct(fn: () => Promise<void>) {
  let promise: Promise<void> | undefined;
  act(() => void (promise = fn()));
  await act(async () => await promise);
}

function makeTestHook({ player }: { player?: Player }) {
  const all: MessagePipelineContext[] = [];
  function Hook() {
    const value = useMessagePipeline(useCallback((ctx) => ctx, []));
    all.push(value);
    return value;
  }
  let currentPlayer = player;
  function Wrapper({ children }: PropsWithChildren) {
    const [config] = useState(() => makeMockAppConfiguration());
    return (
      <AppConfigurationContext.Provider value={config}>
        <MockCurrentLayoutProvider>
          <MessagePipelineProvider player={currentPlayer}>{children}</MessagePipelineProvider>
        </MockCurrentLayoutProvider>
      </AppConfigurationContext.Provider>
    );
  }
  function setPlayer(newPlayer: Player) {
    currentPlayer = newPlayer;
  }

  return { Hook, Wrapper, all, setPlayer };
}

describe("MessagePipelineProvider/useMessagePipeline", () => {
  it("returns empty data when no player is given", () => {
    const { Hook, Wrapper, all } = makeTestHook({});
    renderHook(Hook, { wrapper: Wrapper });
    expect(all).toEqual([
      {
        playerState: {
          activeData: undefined,
          capabilities: [],
          presence: PlayerPresence.NOT_PRESENT,
          playerId: "",
          progress: {},
        },
        subscriptions: [],
        messageEventsBySubscriberId: new Map(),
        sortedTopics: [],
        datatypes: new Map(),
        setSubscriptions: expect.any(Function),
        setPublishers: expect.any(Function),
        publish: expect.any(Function),
        callService: expect.any(Function),
        fetchAsset: expect.any(Function),
        startPlayback: undefined,
        pausePlayback: undefined,
        setPlaybackSpeed: undefined,
        seekPlayback: undefined,
        setParameter: expect.any(Function),
        pauseFrame: expect.any(Function),
      },
      {
        playerState: {
          activeData: undefined,
          capabilities: [],
          presence: PlayerPresence.NOT_PRESENT,
          playerId: "",
          progress: {},
        },
        subscriptions: [],
        messageEventsBySubscriberId: new Map(),
        sortedTopics: [],
        datatypes: new Map(),
        setSubscriptions: expect.any(Function),
        setPublishers: expect.any(Function),
        publish: expect.any(Function),
        callService: expect.any(Function),
        fetchAsset: expect.any(Function),
        startPlayback: undefined,
        pausePlayback: undefined,
        setPlaybackSpeed: undefined,
        seekPlayback: undefined,
        setParameter: expect.any(Function),
        pauseFrame: expect.any(Function),
      },
    ]);
  });

  it("updates when the player emits a new state", async () => {
    const player = new FakePlayer();
    const { Hook, Wrapper, all } = makeTestHook({ player });
    renderHook(Hook, { wrapper: Wrapper });

    await doubleAct(async () => {
      await player.emit();
    });
    expect(all).toEqual([
      expect.objectContaining({
        playerState: {
          activeData: undefined,
          capabilities: [],
          presence: PlayerPresence.NOT_PRESENT,
          playerId: "",
          progress: {},
        },
      }),
      expect.objectContaining({
        playerState: {
          activeData: undefined,
          capabilities: [],
          presence: PlayerPresence.PRESENT,
          playerId: "test",
          progress: {},
        },
      }),
    ]);
  });

  it("updates datatypes when player datatypes change", async () => {
    const player = new FakePlayer();
    const { Hook, Wrapper, all } = makeTestHook({ player });
    renderHook(Hook, { wrapper: Wrapper });

    await doubleAct(async () => {
      await player.emit({
        activeData: {
          messages: [],
          totalBytesReceived: 0,
          currentTime: { sec: 0, nsec: 0 },
          startTime: { sec: 0, nsec: 0 },
          endTime: { sec: 0, nsec: 0 },
          isPlaying: false,
          speed: 1,
          lastSeekTime: 0,
          topics: [],
          topicStats: new Map(),
          datatypes: new Map([["Foo", { definitions: [] }]]),
        },
      });
    });
    await doubleAct(async () => {
      await player.emit({
        activeData: {
          messages: [],
          totalBytesReceived: 0,
          currentTime: { sec: 0, nsec: 0 },
          startTime: { sec: 0, nsec: 0 },
          endTime: { sec: 0, nsec: 0 },
          isPlaying: false,
          speed: 1,
          lastSeekTime: 0,
          topics: [],
          topicStats: new Map(),
          datatypes: new Map([
            ["Foo", { definitions: [] }],
            ["Bar", { definitions: [] }],
          ]),
        },
      });
    });
    expect(all.length).toBe(3);
    expect(all[0]!.playerState).toEqual({
      activeData: undefined,
      capabilities: [],
      presence: PlayerPresence.NOT_PRESENT,
      playerId: "",
      progress: {},
    });
    expect(all[1]!.datatypes).toEqual(new Map([["Foo", { definitions: [] }]]));
    expect(all[2]!.datatypes).toEqual(
      new Map([
        ["Foo", { definitions: [] }],
        ["Bar", { definitions: [] }],
      ]),
    );
  });

  it("updates sortedTopics when player topics change", async () => {
    const player = new FakePlayer();
    const { Hook, Wrapper, all } = makeTestHook({ player });
    renderHook(Hook, { wrapper: Wrapper });

    await doubleAct(async () => {
      await player.emit({
        activeData: {
          messages: [],
          totalBytesReceived: 0,
          currentTime: { sec: 0, nsec: 0 },
          startTime: { sec: 0, nsec: 0 },
          endTime: { sec: 0, nsec: 0 },
          isPlaying: false,
          speed: 1,
          lastSeekTime: 0,
          topics: [{ name: "foo", schemaName: "Foo" }],
          topicStats: new Map(),
          datatypes: new Map(),
        },
      });
    });
    await doubleAct(async () => {
      await player.emit({
        activeData: {
          messages: [],
          totalBytesReceived: 0,
          currentTime: { sec: 0, nsec: 0 },
          startTime: { sec: 0, nsec: 0 },
          endTime: { sec: 0, nsec: 0 },
          isPlaying: false,
          speed: 1,
          lastSeekTime: 0,
          topics: [
            { name: "foo", schemaName: "Foo" },
            { name: "bar", schemaName: "Bar" },
          ],
          topicStats: new Map(),
          datatypes: new Map(),
        },
      });
    });
    expect(all).toEqual([
      expect.objectContaining<DeepPartial<(typeof all)[0]>>({
        playerState: {
          activeData: undefined,
          capabilities: [],
          presence: PlayerPresence.NOT_PRESENT,
          playerId: "",
          progress: {},
        },
      }),
      expect.objectContaining<DeepPartial<(typeof all)[0]>>({
        sortedTopics: [{ name: "foo", schemaName: "Foo" }],
      }),
      expect.objectContaining<DeepPartial<(typeof all)[0]>>({
        sortedTopics: [
          { name: "bar", schemaName: "Bar" },
          { name: "foo", schemaName: "Foo" },
        ],
      }),
    ]);
  });

  it("throws an error when the player emits before the previous emit has been resolved", async () => {
    const player = new FakePlayer();
    const { Hook, Wrapper } = makeTestHook({ player });
    renderHook(Hook, {
      wrapper: Wrapper,
    });
    act(() => {
      void player.emit();
    });
    await expect(async () => {
      await player.emit();
    }).rejects.toThrow("New playerState was emitted before last playerState was rendered.");
  });

  it("sets subscriptions", async () => {
    const player = new FakePlayer();
    const { Hook, Wrapper } = makeTestHook({ player });
    const { result } = renderHook(Hook, {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.setSubscriptions("test", [{ topic: "/studio/test" }]);
    });
    expect(result.current.subscriptions).toEqual([{ topic: "/studio/test" }]);

    act(() => {
      result.current.setSubscriptions("bar", [{ topic: "/studio/test2" }]);
    });
    expect(result.current.subscriptions).toEqual([
      { topic: "/studio/test" },
      { topic: "/studio/test2" },
    ]);
    const lastSubscriptions = result.current.subscriptions;
    // cause the player to emit a frame outside the render loop to trigger another render
    await doubleAct(async () => {
      await player.emit();
    });
    // make sure subscriptions are reference equal when they don't change
    expect(result.current.subscriptions).toBe(lastSubscriptions);
  });

  // When a new subscription comes in on a topic, we inject the last message for the topic
  // to the subscription. This allows panels to receive "latched" topics which the player won't
  // send again itself.
  it("emits the last message on a topic for new subscriptions", async () => {
    const player = new FakePlayer();
    const { Hook, Wrapper } = makeTestHook({ player });
    const { result } = renderHook(Hook, {
      wrapper: Wrapper,
    });
    await doubleAct(async () => {
      await player.emit({
        activeData: {
          messages: [
            {
              topic: "/input/foo",
              receiveTime: { sec: 0, nsec: 0 },
              message: { foo: "bar" },
              schemaName: "foo",
              sizeInBytes: 0,
            },
          ],
          currentTime: { sec: 0, nsec: 0 },
          startTime: { sec: 0, nsec: 0 },
          endTime: { sec: 1, nsec: 0 },
          isPlaying: true,
          speed: 0.2,
          lastSeekTime: 1234,
          topics: [{ name: "/input/foo", schemaName: "foo" }],
          topicStats: new Map<string, TopicStats>([["/input/foo", { numMessages: 1 }]]),
          datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
          totalBytesReceived: 1234,
        },
      });
    });

    act(() => {
      result.current.setSubscriptions("custom-id", [{ topic: "/input/foo" }]);
    });
    expect(result.current.subscriptions).toEqual([{ topic: "/input/foo" }]);

    // should immediately emit last messages on new subscription
    expect(result.current.messageEventsBySubscriberId.get("custom-id")).toEqual([
      {
        message: {
          foo: "bar",
        },
        receiveTime: {
          nsec: 0,
          sec: 0,
        },
        schemaName: "foo",
        sizeInBytes: 0,
        topic: "/input/foo",
      },
    ]);
  });

  it("does not duplicate messages if a panel subscribes to a topic twice", async () => {
    const player = new FakePlayer();
    const { Hook, Wrapper } = makeTestHook({ player });
    const { result } = renderHook(Hook, {
      wrapper: Wrapper,
    });

    await doubleAct(async () => {
      await player.emit({
        activeData: {
          messages: [],
          currentTime: { sec: 0, nsec: 0 },
          startTime: { sec: 0, nsec: 0 },
          endTime: { sec: 1, nsec: 0 },
          isPlaying: true,
          speed: 0.2,
          lastSeekTime: 1234,
          topics: [{ name: "/input/foo", schemaName: "foo" }],
          topicStats: new Map<string, TopicStats>([["/input/foo", { numMessages: 1 }]]),
          datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
          totalBytesReceived: 1234,
        },
      });
    });

    act(() => {
      result.current.setSubscriptions("custom-id", [
        { topic: "/input/foo" },
        { topic: "/input/foo" },
      ]);
    });
    expect(result.current.subscriptions).toEqual([{ topic: "/input/foo" }]);

    // Emit empty player state to process new subscriptions
    await doubleAct(async () => {
      await player.emit({
        activeData: {
          messages: [
            {
              topic: "/input/foo",
              receiveTime: { sec: 0, nsec: 0 },
              message: { foo: "bar" },
              schemaName: "foo",
              sizeInBytes: 0,
            },
          ],
          currentTime: { sec: 0, nsec: 0 },
          startTime: { sec: 0, nsec: 0 },
          endTime: { sec: 1, nsec: 0 },
          isPlaying: true,
          speed: 0.2,
          lastSeekTime: 1234,
          topics: [{ name: "/input/foo", schemaName: "foo" }],
          topicStats: new Map<string, TopicStats>([["/input/foo", { numMessages: 1 }]]),
          datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
          totalBytesReceived: 1234,
        },
      });
    });

    expect(result.current.messageEventsBySubscriberId.get("custom-id")).toEqual([
      {
        message: {
          foo: "bar",
        },
        receiveTime: {
          nsec: 0,
          sec: 0,
        },
        schemaName: "foo",
        sizeInBytes: 0,
        topic: "/input/foo",
      },
    ]);
  });

  // https://github.com/foxglove/studio/issues/4694
  it("does not inject the last message when the player changes", async () => {
    const player = new FakePlayer();
    const { Hook, Wrapper, setPlayer } = makeTestHook({ player });
    const { result, rerender } = renderHook(Hook, { wrapper: Wrapper });
    await doubleAct(async () => {
      await player.emit({
        activeData: {
          messages: [
            {
              topic: "/input/foo",
              receiveTime: { sec: 0, nsec: 0 },
              message: { foo: "bar" },
              schemaName: "foo",
              sizeInBytes: 0,
            },
          ],
          currentTime: { sec: 0, nsec: 0 },
          startTime: { sec: 0, nsec: 0 },
          endTime: { sec: 1, nsec: 0 },
          isPlaying: true,
          speed: 0.2,
          lastSeekTime: 1234,
          topics: [{ name: "/input/foo", schemaName: "foo" }],
          topicStats: new Map<string, TopicStats>([["/input/foo", { numMessages: 1 }]]),
          datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
          totalBytesReceived: 1234,
        },
      });
    });

    act(() => {
      result.current.setSubscriptions("custom-id", [{ topic: "/input/foo" }]);
    });
    expect(result.current.subscriptions).toEqual([{ topic: "/input/foo" }]);

    expect(result.current.messageEventsBySubscriberId.get("custom-id")).toEqual([
      {
        message: {
          foo: "bar",
        },
        receiveTime: {
          nsec: 0,
          sec: 0,
        },
        schemaName: "foo",
        sizeInBytes: 0,
        topic: "/input/foo",
      },
    ]);
    const player2 = new FakePlayer();
    player2.playerId = "player2";
    setPlayer(player2);
    rerender();

    // Unsubscribe and re-subscribe to trigger injection of old messages
    act(() => {
      result.current.setSubscriptions("custom-id", []);
    });
    act(() => {
      result.current.setSubscriptions("custom-id", [{ topic: "/input/foo" }]);
    });
    expect(result.current.subscriptions).toEqual([{ topic: "/input/foo" }]);

    await doubleAct(async () => {
      await player2.emit({
        activeData: {
          messages: [],
          currentTime: { sec: 0, nsec: 0 },
          startTime: { sec: 0, nsec: 0 },
          endTime: { sec: 1, nsec: 0 },
          isPlaying: true,
          speed: 0.2,
          lastSeekTime: 1234,
          topics: [],
          topicStats: new Map(),
          datatypes: new Map(),
          totalBytesReceived: 1234,
        },
      });
    });

    expect(result.current.playerState.playerId).toEqual("player2");
    expect(result.current.messageEventsBySubscriberId.get("custom-id")).toBeUndefined();
  });

  it("does not inject the last message when the player id changes", async () => {
    const player = new FakePlayer();
    const { Hook, Wrapper } = makeTestHook({ player });
    const { result, rerender } = renderHook(Hook, { wrapper: Wrapper });
    await doubleAct(async () => {
      await player.emit({
        activeData: {
          messages: [
            {
              topic: "/input/foo",
              receiveTime: { sec: 0, nsec: 0 },
              message: { foo: "bar" },
              schemaName: "foo",
              sizeInBytes: 0,
            },
          ],
          currentTime: { sec: 0, nsec: 0 },
          startTime: { sec: 0, nsec: 0 },
          endTime: { sec: 1, nsec: 0 },
          isPlaying: true,
          speed: 0.2,
          lastSeekTime: 1234,
          topics: [{ name: "/input/foo", schemaName: "foo" }],
          topicStats: new Map<string, TopicStats>([["/input/foo", { numMessages: 1 }]]),
          datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
          totalBytesReceived: 1234,
        },
      });
    });

    act(() => {
      result.current.setSubscriptions("custom-id", [{ topic: "/input/foo" }]);
    });
    expect(result.current.subscriptions).toEqual([{ topic: "/input/foo" }]);

    expect(result.current.messageEventsBySubscriberId.get("custom-id")).toEqual([
      {
        message: {
          foo: "bar",
        },
        receiveTime: {
          nsec: 0,
          sec: 0,
        },
        schemaName: "foo",
        sizeInBytes: 0,
        topic: "/input/foo",
      },
    ]);
    rerender();

    // Unsubscribe and re-subscribe to trigger injection of old messages
    act(() => {
      result.current.setSubscriptions("custom-id", []);
    });
    act(() => {
      result.current.setSubscriptions("custom-id", [{ topic: "/input/foo" }]);
    });
    expect(result.current.subscriptions).toEqual([{ topic: "/input/foo" }]);
    await doubleAct(async () => {
      await player.emit({
        playerId: "player2",
        activeData: {
          messages: [],
          currentTime: { sec: 0, nsec: 0 },
          startTime: { sec: 0, nsec: 0 },
          endTime: { sec: 1, nsec: 0 },
          isPlaying: true,
          speed: 0.2,
          lastSeekTime: 1234,
          topics: [],
          topicStats: new Map(),
          datatypes: new Map(),
          totalBytesReceived: 1234,
        },
      });
    });

    expect(result.current.playerState.playerId).toEqual("player2");
    expect(result.current.messageEventsBySubscriberId.get("custom-id")).toBeUndefined();
  });

  it("sets publishers", async () => {
    const player = new FakePlayer();
    const { Hook, Wrapper } = makeTestHook({ player });
    const { result } = renderHook(Hook, { wrapper: Wrapper });

    act(() => {
      result.current.setPublishers("test", [{ topic: "/studio/test", schemaName: "test" }]);
    });
    expect(player.publishers).toEqual<typeof player.publishers>([
      { topic: "/studio/test", schemaName: "test" },
    ]);

    act(() => {
      result.current.setPublishers("bar", [{ topic: "/studio/test2", schemaName: "test2" }]);
    });
    expect(player.publishers).toEqual<typeof player.publishers>([
      { topic: "/studio/test", schemaName: "test" },
      { topic: "/studio/test2", schemaName: "test2" },
    ]);

    const lastPublishers = player.publishers;
    // cause the player to emit a frame outside the render loop to trigger another render
    await doubleAct(async () => {
      await player.emit();
    });
    // make sure publishers are reference equal when they don't change
    expect(player.publishers).toBe(lastPublishers);
  });

  it("renders with the same callback functions every time", async () => {
    const player = new FakePlayer();
    const { Hook, Wrapper } = makeTestHook({ player });
    const { result } = renderHook(Hook, {
      wrapper: Wrapper,
    });

    const lastContext = result.current;
    await doubleAct(async () => {
      await player.emit();
    });
    for (const [key, value] of Object.entries(result.current)) {
      if (typeof value === "function") {
        expect((lastContext as Record<string, unknown>)[key]).toBe(value);
      }
    }
  });

  it("resolves listener promise after each render", async () => {
    const player = new FakePlayer();
    const { Hook, Wrapper, all } = makeTestHook({ player });
    renderHook(Hook, {
      wrapper: Wrapper,
    });

    // once for the initialization message
    expect(all.length).toBe(1);
    // Now wait for the player state emit cycle to complete.
    // This promise should resolve when the render loop finishes.
    await doubleAct(async () => {
      await player.emit();
    });
    expect(all.length).toBe(2);
    await doubleAct(async () => {
      await player.emit();
    });
    expect(all.length).toBe(3);
  });

  it("proxies player methods to player, accounting for capabilities", async () => {
    const player = new FakePlayer();
    jest.spyOn(player, "startPlayback");
    jest.spyOn(player, "pausePlayback");
    jest.spyOn(player, "setPlaybackSpeed");
    jest.spyOn(player, "seekPlayback");
    const { Hook, Wrapper } = makeTestHook({ player });
    const { result } = renderHook(Hook, {
      wrapper: Wrapper,
    });

    expect(result.current.startPlayback).toBeUndefined();
    expect(result.current.pausePlayback).toBeUndefined();
    expect(result.current.setPlaybackSpeed).toBeUndefined();
    expect(result.current.seekPlayback).toBeUndefined();

    player.setCapabilities([PlayerCapabilities.playbackControl]);

    await doubleAct(async () => {
      await player.emit();
    });

    expect(result.current.startPlayback).not.toBeUndefined();
    expect(result.current.pausePlayback).not.toBeUndefined();
    expect(result.current.setPlaybackSpeed).toBeUndefined();
    expect(result.current.seekPlayback).not.toBeUndefined();

    expect(player.startPlayback).toHaveBeenCalledTimes(0);
    expect(player.pausePlayback).toHaveBeenCalledTimes(0);
    expect(player.seekPlayback).toHaveBeenCalledTimes(0);
    result.current.startPlayback!();
    result.current.pausePlayback!();
    result.current.seekPlayback!({ sec: 1, nsec: 0 });
    expect(player.startPlayback).toHaveBeenCalledTimes(1);
    expect(player.pausePlayback).toHaveBeenCalledTimes(1);
    expect(player.seekPlayback).toHaveBeenCalledWith({ sec: 1, nsec: 0 });

    player.setCapabilities([PlayerCapabilities.playbackControl, PlayerCapabilities.setSpeed]);

    await doubleAct(async () => {
      await player.emit();
    });
    expect(player.setPlaybackSpeed).toHaveBeenCalledTimes(0);
    result.current.setPlaybackSpeed!(0.5);
    expect(player.setPlaybackSpeed).toHaveBeenCalledWith(0.5);
  });

  it("closes player on unmount", () => {
    const player = new FakePlayer();
    jest.spyOn(player, "close");
    const { Hook, Wrapper } = makeTestHook({ player });
    const { unmount } = renderHook(Hook, {
      wrapper: Wrapper,
    });

    unmount();
    expect(player.close).toHaveBeenCalledTimes(1);
  });

  it("does not throw when interacting w/ context and player is missing", () => {
    expect(() => {
      const { Hook, Wrapper } = makeTestHook({});
      const { result } = renderHook(Hook, { wrapper: Wrapper });
      expect(result.current.startPlayback).toBeUndefined();
      expect(result.current.pausePlayback).toBeUndefined();
      expect(result.current.setPlaybackSpeed).toBeUndefined();
      expect(result.current.seekPlayback).toBeUndefined();
      result.current.publish({ topic: "/foo", msg: {} });
    }).not.toThrow();
  });

  describe("pauseFrame", () => {
    it("frames automatically resolve without calling pauseFrame", async () => {
      let hasFinishedFrame = false;
      const player = new FakePlayer();
      const { Hook, Wrapper } = makeTestHook({ player });
      renderHook(Hook, { wrapper: Wrapper });

      await doubleAct(async () => {
        await player.emit().then(() => {
          hasFinishedFrame = true;
        });
      });
      await delay(20);
      expect(hasFinishedFrame).toEqual(true);
    });

    it("when pausing for multiple promises, waits for all of them to resolve", async () => {
      // Start by pausing twice.
      const player = new FakePlayer();
      const { Hook, Wrapper } = makeTestHook({ player });
      const { result } = renderHook(Hook, { wrapper: Wrapper });
      const resumeFunctions = [
        result.current.pauseFrame(""),
        result.current.pauseFrame(""),
      ] as const;

      // Trigger the next emit.
      let hasFinishedFrame = false;
      await act(async () => {
        void player.emit().then(() => {
          hasFinishedFrame = true;
        });
      });
      await delay(20);
      // We are still pausing.
      expect(hasFinishedFrame).toEqual(false);

      // If we resume only one, we still don't move on to the next frame.
      resumeFunctions[0]();
      await delay(20);
      expect(hasFinishedFrame).toEqual(false);

      // If we resume them all, we can move on to the next frame.
      resumeFunctions[1]();
      await delay(20);
      expect(hasFinishedFrame).toEqual(true);
    });

    it("can wait for promises multiple frames in a row", async () => {
      expect.assertions(8);
      const player = new FakePlayer();
      const { Hook, Wrapper } = makeTestHook({ player });
      const { result } = renderHook(Hook, { wrapper: Wrapper });
      async function runSingleFrame({ shouldPause }: { shouldPause: boolean }) {
        let resumeFn;
        if (shouldPause) {
          resumeFn = result.current.pauseFrame("");
        }

        let hasFinishedFrame = false;
        await act(async () => {
          void player.emit().then(() => {
            hasFinishedFrame = true;
          });
        });
        await delay(20);

        if (resumeFn) {
          expect(hasFinishedFrame).toEqual(false);
          resumeFn();
          await delay(20);
          expect(hasFinishedFrame).toEqual(true);
        } else {
          expect(hasFinishedFrame).toEqual(true);
        }
      }

      await runSingleFrame({ shouldPause: true });
      await runSingleFrame({ shouldPause: true });
      await runSingleFrame({ shouldPause: false });
      await runSingleFrame({ shouldPause: false });
      await runSingleFrame({ shouldPause: true });
    });

    it("Adding a promise that is previously resolved just plays through", async () => {
      const player = new FakePlayer();
      const { Hook, Wrapper } = makeTestHook({ player });
      const { result } = renderHook(Hook, { wrapper: Wrapper });

      // Pause the current frame, but immediately resume it before we actually emit.
      const resumeFn = result.current.pauseFrame("");
      resumeFn();

      // Then trigger the next emit.
      let hasFinishedFrame = false;
      await act(async () => {
        void player.emit().then(() => {
          hasFinishedFrame = true;
        });
      });

      await delay(20);

      // Since we have already resumed, we automatically move on to the next frame.
      expect(hasFinishedFrame).toEqual(true);
    });

    it("Adding a promise that does not resolve eventually results in an error, and then continues playing", async () => {
      const player = new FakePlayer();
      const { Hook, Wrapper } = makeTestHook({ player });
      const { result } = renderHook(Hook, { wrapper: Wrapper });
      // Pause the current frame.
      result.current.pauseFrame("");

      // Then trigger the next emit.
      let hasFinishedFrame = false;
      await act(async () => {
        void player.emit().then(() => {
          hasFinishedFrame = true;
        });
      });
      await delay(20);
      expect(hasFinishedFrame).toEqual(false);

      await delay(MAX_PROMISE_TIMEOUT_TIME_MS + 20);
      expect(hasFinishedFrame).toEqual(true);
    });

    it("Adding multiple promises that do not resolve eventually results in an error, and then continues playing", async () => {
      const player = new FakePlayer();
      const { Hook, Wrapper } = makeTestHook({ player });
      const { result } = renderHook(Hook, { wrapper: Wrapper });

      // Pause the current frame twice.
      result.current.pauseFrame("");
      result.current.pauseFrame("");

      // Then trigger the next emit.
      let hasFinishedFrame = false;
      await act(async () => {
        void player.emit().then(() => {
          hasFinishedFrame = true;
        });
      });
      await delay(20);
      expect(hasFinishedFrame).toEqual(false);

      await delay(MAX_PROMISE_TIMEOUT_TIME_MS + 20);
      expect(hasFinishedFrame).toEqual(true);
    });

    it("does not accidentally resolve the second player's promise when replacing the player", async () => {
      const player = new FakePlayer();
      const { Hook, Wrapper, setPlayer } = makeTestHook({ player });
      const { result, rerender } = renderHook(Hook, { wrapper: Wrapper });
      // Pause the current frame.
      const firstPlayerResumeFn = result.current.pauseFrame("");

      // Then trigger the next emit.
      act(() => void player.emit());
      await delay(20);

      // Replace the player.
      const newPlayer = new FakePlayer();
      setPlayer(newPlayer);
      rerender();
      await delay(20);

      const secondPlayerResumeFn = result.current.pauseFrame("");
      let secondPlayerHasFinishedFrame = false;
      await act(async () => {
        void newPlayer.emit().then(() => {
          secondPlayerHasFinishedFrame = true;
        });
      });
      await delay(20);

      expect(secondPlayerHasFinishedFrame).toEqual(false);

      firstPlayerResumeFn();
      await delay(20);
      // The first player was resumed, but the second player should not have finished its frame.
      expect(secondPlayerHasFinishedFrame).toEqual(false);

      secondPlayerResumeFn();
      await delay(20);
      // The second player was resumed and can now finish its frame.
      expect(secondPlayerHasFinishedFrame).toEqual(true);
    });
  });
});
