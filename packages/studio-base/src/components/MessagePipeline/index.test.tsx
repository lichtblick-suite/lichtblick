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

import { renderHook, RenderResult } from "@testing-library/react-hooks/dom";
import { last } from "lodash";
import { PropsWithChildren, useCallback, useState } from "react";
import { act } from "react-dom/test-utils";

import AppConfigurationContext from "@foxglove/studio-base/context/AppConfigurationContext";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { Player, PlayerPresence, PlayerStateActiveData } from "@foxglove/studio-base/players/types";
import delay from "@foxglove/studio-base/util/delay";
import { makeConfiguration } from "@foxglove/studio-base/util/makeConfiguration";
import tick from "@foxglove/studio-base/util/tick";

import { MessagePipelineProvider, useMessagePipeline, MessagePipelineContext } from ".";
import FakePlayer from "./FakePlayer";
import { MAX_PROMISE_TIMEOUT_TIME_MS } from "./pauseFrameForPromise";

jest.setTimeout(MAX_PROMISE_TIMEOUT_TIME_MS * 3);

type WrapperProps = {
  player?: Player;
  globalVariables?: GlobalVariables;
};

function Hook(_props: WrapperProps) {
  return useMessagePipeline(useCallback((value) => value, []));
}

function Wrapper({ children, player, globalVariables = {} }: PropsWithChildren<WrapperProps>) {
  const [config] = useState(() => makeConfiguration());
  return (
    <AppConfigurationContext.Provider value={config}>
      <MessagePipelineProvider player={player} globalVariables={globalVariables}>
        {children}
      </MessagePipelineProvider>
    </AppConfigurationContext.Provider>
  );
}

describe("MessagePipelineProvider/useMessagePipeline", () => {
  it("returns empty data when no player is given", () => {
    const { result } = renderHook(Hook, { wrapper: Wrapper });
    expect(result.all).toEqual([
      {
        playerState: {
          activeData: undefined,
          capabilities: [],
          presence: PlayerPresence.NOT_PRESENT,
          playerId: "",
          progress: {},
        },
        subscriptions: [],
        publishers: [],
        frame: {},
        sortedTopics: [],
        datatypes: new Map(),
        setSubscriptions: expect.any(Function),
        setPublishers: expect.any(Function),
        publish: expect.any(Function),
        startPlayback: expect.any(Function),
        pausePlayback: expect.any(Function),
        setPlaybackSpeed: expect.any(Function),
        seekPlayback: expect.any(Function),
        setParameter: expect.any(Function),
        pauseFrame: expect.any(Function),
        requestBackfill: expect.any(Function),
      },
    ]);
  });

  it("updates when the player emits a new state", async () => {
    const player = new FakePlayer();
    const { result } = renderHook(Hook, {
      wrapper: Wrapper,
      initialProps: { player },
    });

    await act(async () => await player.emit());
    expect(result.all).toEqual([
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

  it("throws an error when the player emits before the previous emit has been resolved", async () => {
    const player = new FakePlayer();
    renderHook(Hook, {
      wrapper: Wrapper,
      initialProps: { player },
    });
    act(() => {
      void player.emit();
    });
    await expect(async () => await player.emit()).rejects.toThrow(
      "New playerState was emitted before last playerState was rendered.",
    );
  });

  it("waits for the previous frame to finish before calling setGlobalVariables again", async () => {
    const player = new FakePlayer();
    const mockSetGlobalVariables = jest.spyOn(player, "setGlobalVariables");
    const { result, rerender } = renderHook(Hook, {
      wrapper: Wrapper,
      initialProps: { player, globalVariables: {} },
    });
    await tick();
    await tick();

    expect(mockSetGlobalVariables.mock.calls).toEqual([[{}]]);
    const onFrameRendered = result.current.pauseFrame("Wait");

    // Pass in new globalVariables and make sure they aren't used until the frame is done
    rerender({ player, globalVariables: { futureTime: 1 } });
    await tick();
    expect(mockSetGlobalVariables.mock.calls).toEqual([[{}]]);

    // Once the frame is done, setGlobalVariables will be called with the new value
    onFrameRendered();
    await tick();
    await tick();
    expect(mockSetGlobalVariables.mock.calls).toEqual([[{}], [{ futureTime: 1 }]]);
  });

  it("sets subscriptions", async () => {
    const player = new FakePlayer();
    const { result } = renderHook(Hook, {
      wrapper: Wrapper,
      initialProps: { player },
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
    await act(async () => await player.emit());
    // make sure subscriptions are reference equal when they don't change
    expect(result.current.subscriptions).toBe(lastSubscriptions);
  });

  it("sets publishers", async () => {
    const player = new FakePlayer();
    const { result } = renderHook(Hook, {
      wrapper: Wrapper,
      initialProps: { player },
    });

    act(() => result.current.setPublishers("test", [{ topic: "/studio/test", datatype: "test" }]));
    expect(result.current.publishers).toEqual([{ topic: "/studio/test", datatype: "test" }]);

    act(() => result.current.setPublishers("bar", [{ topic: "/studio/test2", datatype: "test2" }]));
    expect(result.current.publishers).toEqual([
      { topic: "/studio/test", datatype: "test" },
      { topic: "/studio/test2", datatype: "test2" },
    ]);

    const lastPublishers = result.current.publishers;
    // cause the player to emit a frame outside the render loop to trigger another render
    await act(async () => await player.emit());
    // make sure publishers are reference equal when they don't change
    expect(result.current.publishers).toBe(lastPublishers);
  });

  it("renders with the same callback functions every time", async () => {
    const player = new FakePlayer();
    const { result } = renderHook(Hook, {
      wrapper: Wrapper,
      initialProps: { player },
    });

    const lastContext = result.current;
    await act(async () => await player.emit());
    for (const [key, value] of Object.entries(result.current)) {
      if (typeof value === "function") {
        expect((lastContext as Record<string, unknown>)[key]).toBe(value);
      }
    }
  });

  it("resolves listener promise after each render", async () => {
    const player = new FakePlayer();
    const { result } = renderHook(Hook, {
      wrapper: Wrapper,
      initialProps: { player },
    });

    // once for the initialization message
    expect(result.all.length).toBe(1);
    // Now wait for the player state emit cycle to complete.
    // This promise should resolve when the render loop finishes.
    await act(async () => await player.emit());
    expect(result.all.length).toBe(2);
    await act(async () => await player.emit());
    expect(result.all.length).toBe(3);
  });

  it("proxies player methods to player", () => {
    const player = new FakePlayer();
    jest.spyOn(player, "startPlayback");
    jest.spyOn(player, "pausePlayback");
    jest.spyOn(player, "setPlaybackSpeed");
    jest.spyOn(player, "seekPlayback");
    const { result } = renderHook(Hook, {
      wrapper: Wrapper,
      initialProps: { player },
    });

    expect(player.startPlayback).toHaveBeenCalledTimes(0);
    expect(player.pausePlayback).toHaveBeenCalledTimes(0);
    expect(player.setPlaybackSpeed).toHaveBeenCalledTimes(0);
    expect(player.seekPlayback).toHaveBeenCalledTimes(0);
    result.current.startPlayback();
    result.current.pausePlayback();
    result.current.setPlaybackSpeed(0.5);
    result.current.seekPlayback({ sec: 1, nsec: 0 });
    expect(player.startPlayback).toHaveBeenCalledTimes(1);
    expect(player.pausePlayback).toHaveBeenCalledTimes(1);
    expect(player.setPlaybackSpeed).toHaveBeenCalledWith(0.5);
    expect(player.seekPlayback).toHaveBeenCalledWith({ sec: 1, nsec: 0 });
  });

  it("closes player on unmount", () => {
    const player = new FakePlayer();
    jest.spyOn(player, "close");
    const { unmount } = renderHook(Hook, {
      wrapper: Wrapper,
      initialProps: { player },
    });

    unmount();
    expect(player.close).toHaveBeenCalledTimes(1);
  });

  describe("when changing the player", () => {
    let player: FakePlayer;
    let player2: FakePlayer;
    let result: RenderResult<MessagePipelineContext>;
    beforeEach(async () => {
      player = new FakePlayer();
      player.playerId = "fake player 1";
      jest.spyOn(player, "close");
      let rerender;
      ({ result, rerender } = renderHook(Hook, {
        wrapper: Wrapper,
        initialProps: { player },
      }));

      await act(async () => await player.emit());
      expect(result.all.length).toBe(2); // eslint-disable-line jest/no-standalone-expect

      player2 = new FakePlayer();
      player2.playerId = "fake player 2";
      rerender({ player: player2 });
      expect(player.close).toHaveBeenCalledTimes(1); // eslint-disable-line jest/no-standalone-expect
      expect(result.all.length).toBe(4); // eslint-disable-line jest/no-standalone-expect
    });

    it("closes old player when new player is supplied and stops old player message flow", async () => {
      await act(async () => await player2.emit());
      expect(result.all.length).toBe(5);
      await act(async () => await player.emit());
      expect(result.all.length).toBe(5);
      expect(
        result.all.map((ctx) => {
          if (ctx instanceof Error) {
            throw ctx;
          }
          return ctx.playerState.playerId;
        }),
      ).toEqual(["", "fake player 1", "fake player 1", "", "fake player 2"]);
    });

    it("does not think the old player is the new player if it emits first", async () => {
      await act(async () => await player.emit());
      expect(result.all.length).toBe(4);
      await act(async () => await player2.emit());
      expect(result.all.length).toBe(5);
      expect(
        result.all.map((ctx) => {
          if (ctx instanceof Error) {
            throw ctx;
          }
          return ctx.playerState.playerId;
        }),
      ).toEqual(["", "fake player 1", "fake player 1", "", "fake player 2"]);
    });
  });

  it("does not throw when interacting w/ context and player is missing", () => {
    expect(() => {
      const { result } = renderHook(Hook, { wrapper: Wrapper });
      result.current.startPlayback();
      result.current.pausePlayback();
      result.current.setPlaybackSpeed(1);
      result.current.seekPlayback({ sec: 1, nsec: 0 });
      result.current.publish({ topic: "/foo", msg: {} });
    }).not.toThrow();
  });

  it("transfers subscriptions and publishers between players", async () => {
    const player = new FakePlayer();
    const { result, rerender } = renderHook(Hook, {
      wrapper: Wrapper,
      initialProps: { player },
    });
    act(() => result.current.setSubscriptions("test", [{ topic: "/studio/test" }]));
    act(() => result.current.setSubscriptions("bar", [{ topic: "/studio/test2" }]));
    act(() => result.current.setPublishers("test", [{ topic: "/studio/test", datatype: "test" }]));

    const player2 = new FakePlayer();
    rerender({ player: player2 });
    expect(player2.subscriptions).toEqual([{ topic: "/studio/test" }, { topic: "/studio/test2" }]);
    expect(player2.publishers).toEqual([{ topic: "/studio/test", datatype: "test" }]);
  });

  it("keeps activeData when closing a player", async () => {
    const player = new FakePlayer();
    const { result, rerender } = renderHook(Hook, {
      wrapper: Wrapper,
      initialProps: { player },
    });
    const activeData: PlayerStateActiveData = {
      messages: [],
      messageOrder: "receiveTime",
      currentTime: { sec: 0, nsec: 0 },
      startTime: { sec: 0, nsec: 0 },
      endTime: { sec: 1, nsec: 0 },
      isPlaying: true,
      speed: 0.2,
      lastSeekTime: 1234,
      topics: [{ name: "/input/foo", datatype: "foo" }],
      datatypes: new Map(Object.entries({ foo: { definitions: [] } })),
      parsedMessageDefinitionsByTopic: {},
      totalBytesReceived: 1234,
    };
    await act(async () => await player.emit({ activeData }));
    expect(result.all.length).toBe(2);

    rerender({ player: undefined });
    expect(result.all.length).toBe(4);
    expect((last(result.all) as MessagePipelineContext).playerState).toEqual({
      activeData,
      capabilities: [],
      presence: PlayerPresence.NOT_PRESENT,
      playerId: "",
      progress: {},
    });
  });

  describe("pauseFrame", () => {
    it("frames automatically resolve without calling pauseFrame", async () => {
      let hasFinishedFrame = false;
      const player = new FakePlayer();
      renderHook(Hook, {
        wrapper: Wrapper,
        initialProps: { player },
      });

      await act(async () => {
        return await player.emit().then(() => {
          hasFinishedFrame = true;
        });
      });
      await delay(20);
      expect(hasFinishedFrame).toEqual(true);
    });

    it("when pausing for multiple promises, waits for all of them to resolve", async () => {
      // Start by pausing twice.
      const player = new FakePlayer();
      const { result } = renderHook(Hook, {
        wrapper: Wrapper,
        initialProps: { player },
      });
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
      const { result } = renderHook(Hook, {
        wrapper: Wrapper,
        initialProps: { player },
      });
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
      const { result } = renderHook(Hook, {
        wrapper: Wrapper,
        initialProps: { player },
      });

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
      const { result } = renderHook(Hook, {
        wrapper: Wrapper,
        initialProps: { player },
      });
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
      const { result } = renderHook(Hook, {
        wrapper: Wrapper,
        initialProps: { player },
      });

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
      const { result, rerender } = renderHook(Hook, {
        wrapper: Wrapper,
        initialProps: { player },
      });
      // Pause the current frame.
      const firstPlayerResumeFn = result.current.pauseFrame("");

      // Then trigger the next emit.
      act(() => void player.emit());
      await delay(20);

      // Replace the player.
      const newPlayer = new FakePlayer();
      rerender({ player: newPlayer });
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
