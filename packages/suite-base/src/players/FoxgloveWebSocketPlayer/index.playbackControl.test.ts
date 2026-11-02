// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import NoopMetricsCollector from "@lichtblick/suite-base/players/NoopMetricsCollector";
import { PLAYER_CAPABILITIES } from "@lichtblick/suite-base/players/constants";
import { PlayerState } from "@lichtblick/suite-base/players/types";

import FoxgloveWebSocketPlayer from "./index";
import { decodePlaybackState, encodePlaybackControlRequest } from "./playbackControl";

class MockWebSocket {
  public static lastInstance: MockWebSocket | undefined;
  public binaryType = "";
  public protocol = "foxglove.sdk.v1";
  public onerror?: (event: unknown) => void;
  public onopen?: (event: unknown) => void;
  public onclose?: (event: unknown) => void;
  public onmessage?: (event: unknown) => void;
  public close = jest.fn();
  public send = jest.fn();

  public constructor() {
    MockWebSocket.lastInstance = this;
  }

  public receive(data: unknown): void {
    this.onmessage?.({ data });
  }
}

const serverInfo = {
  op: "serverInfo",
  name: "test",
  capabilities: ["time", "playbackControl"],
  dataStartTime: { sec: 10, nsec: 0 },
  dataEndTime: { sec: 20, nsec: 0 },
};

function playbackStateMessage({
  status,
  timeNs,
  speed,
  didSeek,
}: {
  status: number;
  timeNs: bigint;
  speed: number;
  didSeek: boolean;
}) {
  const buffer = new ArrayBuffer(19);
  const view = new DataView(buffer);
  view.setUint8(0, 0x05);
  view.setUint8(1, status);
  view.setBigUint64(2, timeNs, true);
  view.setFloat32(10, speed, true);
  view.setUint8(14, didSeek ? 1 : 0);
  view.setUint32(15, 0, true);
  return buffer;
}

describe("FoxgloveWebSocketPlayer playback control", () => {
  let player: FoxgloveWebSocketPlayer;
  let ws: MockWebSocket;
  let states: PlayerState[];

  beforeEach(async () => {
    (global as { WebSocket?: unknown }).WebSocket = MockWebSocket;
    states = [];
    player = new FoxgloveWebSocketPlayer({
      url: "ws://test",
      metricsCollector: new NoopMetricsCollector(),
      sourceId: "foxglove-websocket",
    });
    player.setListener(async (state) => {
      states.push(state);
    });
    ws = MockWebSocket.lastInstance!;
    ws.onopen?.({});
    ws.receive(JSON.stringify(serverInfo));
    ws.receive(JSON.stringify({ op: "advertise", channels: [] }));
    await Promise.resolve();
  });

  afterEach(() => {
    player.close();
    delete (global as { WebSocket?: unknown }).WebSocket;
  });

  it("advertises playback capabilities and the server time range", () => {
    const state = states.at(-1)!;
    expect(state.capabilities).toEqual(
      expect.arrayContaining([PLAYER_CAPABILITIES.playbackControl, PLAYER_CAPABILITIES.setSpeed]),
    );
    expect(state.activeData?.startTime).toEqual({ sec: 10, nsec: 0 });
    expect(state.activeData?.endTime).toEqual({ sec: 20, nsec: 0 });
    // before the first playback state the current time starts at the range start
    expect(state.activeData?.currentTime).toEqual({ sec: 10, nsec: 0 });
  });

  it("sends playback control requests", () => {
    player.pausePlayback();
    player.seekPlayback({ sec: 15, nsec: 5 });
    player.setPlaybackSpeed(0.5);
    player.startPlayback();

    const sent = ws.send.mock.calls.map(([data]) => new Uint8Array(data as ArrayBuffer));
    expect(sent).toHaveLength(4);
    expect(sent[0]!.subarray(0, 15)).toEqual(
      new Uint8Array(
        encodePlaybackControlRequest({ play: false, speed: 1, requestId: "" }),
      ).subarray(0, 15),
    );
    expect(sent[1]!.subarray(0, 15)).toEqual(
      new Uint8Array(
        encodePlaybackControlRequest({
          play: false,
          speed: 1,
          seekTimeNs: 15_000_000_005n,
          requestId: "",
        }),
      ).subarray(0, 15),
    );
    expect(sent[2]![1]).toBe(1); // still paused
    expect(new DataView(sent[2]!.buffer).getFloat32(2, true)).toBe(0.5);
    expect(sent[3]![1]).toBe(0); // play
  });

  it("applies playback state from the server", async () => {
    ws.receive(
      playbackStateMessage({ status: 1, timeNs: 12_000_000_000n, speed: 2, didSeek: true }),
    );
    await Promise.resolve();

    const state = states.at(-1)!;
    expect(state.activeData?.isPlaying).toBe(false);
    expect(state.activeData?.speed).toBe(2);
    expect(state.activeData?.currentTime).toEqual({ sec: 12, nsec: 0 });
    expect(state.activeData?.lastSeekTime).toBe(1);
    // server range is not widened by the current time
    expect(state.activeData?.startTime).toEqual({ sec: 10, nsec: 0 });
    expect(state.activeData?.endTime).toEqual({ sec: 20, nsec: 0 });
    expect(state.alerts).toEqual([]);
  });

  it.each([8n, 22n])("keeps the server range for a playback time of %ss", async (sec) => {
    ws.receive(
      playbackStateMessage({ status: 0, timeNs: sec * 1_000_000_000n, speed: 1, didSeek: false }),
    );
    await Promise.resolve();

    const state = states.at(-1)!;
    expect(state.activeData?.startTime).toEqual({ sec: 10, nsec: 0 });
    expect(state.activeData?.endTime).toEqual({ sec: 20, nsec: 0 });
  });

  it("ignores server playback bounds where start is after end", async () => {
    ws.onopen?.({});
    ws.receive(
      JSON.stringify({
        ...serverInfo,
        dataStartTime: { sec: 20, nsec: 0 },
        dataEndTime: { sec: 10, nsec: 0 },
      }),
    );
    await Promise.resolve();
    expect(states.at(-1)!.capabilities).not.toContain(PLAYER_CAPABILITIES.playbackControl);
  });

  it("does not send playback control to a reconnecting socket that is not open yet", () => {
    jest.spyOn(console, "error").mockImplementation(() => {}); // connection-failed alert
    const realSetTimeout = global.setTimeout;
    let reopen: (() => void) | undefined;
    global.setTimeout = ((fn: () => void) => {
      reopen = fn;
    }) as unknown as typeof setTimeout;
    const oldWs = ws;
    try {
      ws.onclose?.({});
    } finally {
      global.setTimeout = realSetTimeout;
    }
    reopen!(); // reconnect; the new socket never opens
    const newWs = MockWebSocket.lastInstance!;
    expect(newWs).not.toBe(oldWs);

    player.pausePlayback();
    expect(oldWs.send).not.toHaveBeenCalled();
    expect(newWs.send).not.toHaveBeenCalled();
    (console.error as jest.Mock).mockRestore();
  });

  it("drops playback capabilities when a same-session serverInfo disables playback", async () => {
    ws.receive(JSON.stringify({ ...serverInfo, sessionId: "s" }));
    ws.receive(JSON.stringify({ ...serverInfo, sessionId: "s", capabilities: ["time"] }));
    await Promise.resolve();

    const state = states.at(-1)!;
    expect(state.capabilities).not.toContain(PLAYER_CAPABILITIES.playbackControl);
    expect(state.capabilities).not.toContain(PLAYER_CAPABILITIES.setSpeed);
  });

  it("uses server playback time instead of wall time when the server has no time capability", async () => {
    ws.onopen?.({});
    ws.receive(JSON.stringify({ ...serverInfo, capabilities: ["playbackControl"] }));
    ws.receive(
      playbackStateMessage({ status: 0, timeNs: 12_000_000_000n, speed: 1, didSeek: false }),
    );
    await Promise.resolve();

    expect(states.at(-1)!.activeData?.currentTime).toEqual({ sec: 12, nsec: 0 });
  });

  it("ignores a non-finite playback speed from the server", async () => {
    ws.receive(
      playbackStateMessage({ status: 0, timeNs: 12_000_000_000n, speed: NaN, didSeek: false }),
    );
    await Promise.resolve();

    expect(states.at(-1)!.activeData?.speed).toBe(1);
  });

  it("ignores negative seek times", () => {
    player.seekPlayback({ sec: -1, nsec: 0 });
    expect(ws.send).not.toHaveBeenCalled();
  });

  it("does not send playback control after the socket closed", () => {
    jest.spyOn(console, "error").mockImplementation(() => {}); // connection-failed alert
    ws.onclose?.({});
    player.pausePlayback();
    expect(ws.send).not.toHaveBeenCalled();
    (console.error as jest.Mock).mockRestore();
  });

  it("drops playback capabilities on reconnect to a server without playbackControl", async () => {
    ws.onopen?.({});
    ws.receive(JSON.stringify({ ...serverInfo, capabilities: ["time"] }));
    ws.receive(
      playbackStateMessage({ status: 1, timeNs: 12_000_000_000n, speed: 2, didSeek: true }),
    );
    await Promise.resolve();

    const state = states.at(-1)!;
    expect(state.capabilities).not.toContain(PLAYER_CAPABILITIES.playbackControl);
    expect(state.capabilities).not.toContain(PLAYER_CAPABILITIES.setSpeed);
    expect(state.activeData?.speed).toBe(1);
  });

  it("sends a uuid request id and decodes an empty one", () => {
    player.pausePlayback();
    const request = ws.send.mock.calls[0]![0] as ArrayBuffer;
    const requestId = new TextDecoder().decode(new Uint8Array(request, 19));
    expect(requestId).toHaveLength(36);
    expect(
      decodePlaybackState(playbackStateMessage({ status: 0, timeNs: 0n, speed: 1, didSeek: false }))
        .requestId,
    ).toBe("");
  });
});
