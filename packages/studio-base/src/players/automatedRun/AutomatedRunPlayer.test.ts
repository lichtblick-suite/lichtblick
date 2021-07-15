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

import { Time } from "@foxglove/rostime";
import { Progress } from "@foxglove/studio-base/players/types";
import delay from "@foxglove/studio-base/util/delay";
import signal from "@foxglove/studio-base/util/signal";

import TestProvider from "../TestProvider";
import AutomatedRunPlayer, {
  AutomatedRunClient,
  AUTOMATED_RUN_START_DELAY,
} from "./AutomatedRunPlayer";

class TestRunClient implements AutomatedRunClient {
  speed = 1;
  msPerFrame = 20000;
  shouldLoadDataBeforePlaying = false;

  finished = false;
  frameStarted = false;

  constructor({
    shouldLoadDataBeforePlaying = false,
  }: { shouldLoadDataBeforePlaying?: boolean } = {}) {
    this.shouldLoadDataBeforePlaying = shouldLoadDataBeforePlaying;
  }

  async onError(err: unknown) {
    throw err;
  }
  start() {
    // no-op
  }
  markTotalFrameStart() {
    this.frameStarted = true;
  }
  markTotalFrameEnd() {
    // no-op
  }
  markFrameRenderStart() {
    // no-op
  }
  markFrameRenderEnd() {
    return 0;
  }
  markPreloadStart = jest.fn();
  markPreloadEnd = jest.fn();
  async onFrameFinished() {
    // no-op
  }
  async finish() {
    this.finished = true;
  }
}

const getMessagesResult = { parsedMessages: [], rosBinaryMessages: undefined };

/* eslint-disable no-underscore-dangle */
describe("AutomatedRunPlayer", () => {
  it("waits to start playing until all frames are loaded when shouldLoadDataBeforePlaying=true", async () => {
    const provider = new TestProvider({ getMessages: async () => getMessagesResult });
    const client = new TestRunClient({ shouldLoadDataBeforePlaying: true });
    const player = new AutomatedRunPlayer(provider, client);
    player.setSubscriptions([{ topic: "/foo/bar" }]);
    await delay(AUTOMATED_RUN_START_DELAY + 10);
    expect(player._initialized).toEqual(true);
    expect(player._isPlaying).toEqual(false);

    const unfinishedProgress: Progress = { fullyLoadedFractionRanges: [{ start: 0, end: 0.5 }] };
    provider.extensionPoint?.progressCallback(unfinishedProgress);
    expect(player._isPlaying).toEqual(false);

    const finishedProgress: Progress = { fullyLoadedFractionRanges: [{ start: 0, end: 1 }] };
    provider.extensionPoint?.progressCallback(finishedProgress);
    expect(player._isPlaying).toEqual(true);
  });

  it("measures preloading performance", async () => {
    const provider = new TestProvider({ getMessages: async () => getMessagesResult });
    const client = new TestRunClient({ shouldLoadDataBeforePlaying: true });
    const player = new AutomatedRunPlayer(provider, client);
    let emitStateCalls = 0;
    player.setListener(async () => {
      emitStateCalls += 1;
    });

    expect(client.markPreloadStart.mock.calls.length).toBe(0);
    expect(client.markPreloadEnd.mock.calls.length).toBe(0);
    expect(emitStateCalls).toBe(0);

    player.setSubscriptions([{ topic: "/foo/bar" }]);
    await delay(AUTOMATED_RUN_START_DELAY + 10);

    // Preloading has started but not finished.
    expect(client.markPreloadStart.mock.calls.length).toBe(1);
    expect(client.markPreloadEnd.mock.calls.length).toBe(0);
    // _emitState called on initialization.
    expect(emitStateCalls).toBe(1);

    expect(player._initialized).toEqual(true);
    expect(player._isPlaying).toEqual(false);

    // Partially preloaded.
    provider.extensionPoint?.progressCallback({
      fullyLoadedFractionRanges: [{ start: 0, end: 0.5 }],
    });
    expect(player._isPlaying).toEqual(false);

    expect(client.markPreloadStart.mock.calls.length).toBe(1);
    expect(client.markPreloadEnd.mock.calls.length).toBe(0);
    // _emitState called on progress.
    expect(emitStateCalls).toBe(2);

    // Finish preloading.
    provider.extensionPoint?.progressCallback({
      fullyLoadedFractionRanges: [{ start: 0, end: 1 }],
    });
    await delay(0);
    // Finished preloading.
    expect(client.markPreloadStart.mock.calls.length).toBe(1);
    expect(client.markPreloadEnd.mock.calls.length).toBe(1);
    // _emitState called on progress (and also during playback.)
    expect(emitStateCalls).toBeGreaterThan(2);
    expect(player._isPlaying).toEqual(true);
  });

  it("makes calls to getMessages with the correct frames", async () => {
    const frames: { startTime: Time; endTime: Time }[] = [];
    const provider = new TestProvider({
      getMessages: async (startTime, endTime) => {
        frames.push({ startTime, endTime });
        return getMessagesResult;
      },
    });
    const client = new TestRunClient();

    const player = new AutomatedRunPlayer(provider, client);
    player.setSubscriptions([{ topic: "/foo/bar" }]);
    await delay(AUTOMATED_RUN_START_DELAY + 10);
    expect(player._initialized).toEqual(true);
    expect(player._isPlaying).toEqual(true);
    const listener = { signal: signal() };
    player.setListener(() => {
      return listener.signal;
    });
    while (!client.finished) {
      // Resolve the previous emit promise, then go to the next frame.
      const previousEmitSignal = listener.signal;
      listener.signal = signal();
      previousEmitSignal.resolve();
      await delay(1);
    }
    expect(frames).toEqual([
      { startTime: { sec: 10, nsec: 0 }, endTime: { sec: 10, nsec: 0 } },
      { startTime: { sec: 10, nsec: 0 }, endTime: { sec: 30, nsec: 0 } },
      { startTime: { sec: 30, nsec: 1 }, endTime: { sec: 50, nsec: 1 } },
      { startTime: { sec: 50, nsec: 2 }, endTime: { sec: 70, nsec: 2 } },
      { startTime: { sec: 70, nsec: 3 }, endTime: { sec: 90, nsec: 3 } },
      { startTime: { sec: 90, nsec: 4 }, endTime: { sec: 100, nsec: 0 } },
    ]);
  });

  async function setupEventLoopTest() {
    let getMessagesCallCount = 0;
    const getMessagesSignal = { signal: signal<typeof getMessagesResult>() };
    const provider = new TestProvider({
      getMessages: async () => {
        getMessagesCallCount++;
        return await getMessagesSignal.signal;
      },
    });
    function resolveNextGetMessages() {
      const previousGetMessagesSignal = getMessagesSignal.signal;
      getMessagesSignal.signal = signal();
      previousGetMessagesSignal.resolve(getMessagesResult);
    }

    const listener = { signal: signal() };
    function resolveNextEmitState() {
      const previousEmitSignal = listener.signal;
      listener.signal = signal();
      previousEmitSignal.resolve();
    }

    const client = new TestRunClient();
    const player = new AutomatedRunPlayer(provider, client);
    player.setSubscriptions([{ topic: "/foo/bar" }]);
    await delay(AUTOMATED_RUN_START_DELAY + 10);
    player.setListener(() => listener.signal);

    // We make one getMessages call at the beginning that we have to resolve.
    resolveNextGetMessages();
    // Get us into the event loop.
    while (!client.frameStarted) {
      resolveNextEmitState();
      await delay(10);
    }

    // Make sure we've resolved our last emit state, so that there is no state waiting to go out.
    resolveNextEmitState();
    await delay(10);

    // Now we're in the run loop.
    // Reset the call count to 0.
    getMessagesCallCount = 0;

    return {
      player,
      client,
      resolveNextGetMessages,
      resolveNextEmitState,
      getGetMessagesCallCount: () => getMessagesCallCount,
    };
  }

  it("awaits the previous emit promise before calling getMessages", async () => {
    const { resolveNextGetMessages, resolveNextEmitState, getGetMessagesCallCount } =
      await setupEventLoopTest();

    resolveNextGetMessages();
    await delay(10);
    // Don't call getMessages until the previous listener has resolved.
    expect(getGetMessagesCallCount()).toEqual(0);
    resolveNextEmitState();
    await delay(10);
    expect(getGetMessagesCallCount()).toEqual(1);
  });
});
