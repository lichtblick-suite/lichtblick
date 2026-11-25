// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import NoopMetricsCollector from "@lichtblick/suite-base/players/NoopMetricsCollector";
import { PlayerState } from "@lichtblick/suite-base/players/types";

import { GET_ALL_PARAMS_PERIOD_MS } from "./constants";
import FoxgloveWebSocketPlayer from "./index";

type Handler = (...args: unknown[]) => void;
const mockHandlers = new Map<string, Handler>();
const mockGetParameters = jest.fn();

jest.mock("@foxglove/ws-protocol", () => {
  const actual = jest.requireActual("@foxglove/ws-protocol");
  class MockFoxgloveClient {
    public static SUPPORTED_SUBPROTOCOL = actual.FoxgloveClient.SUPPORTED_SUBPROTOCOL;
    public on(event: string, handler: Handler): void {
      mockHandlers.set(event, handler);
    }
    public close(): void {}
    public subscribe(): number {
      return 0;
    }
    public getParameters(): void {
      mockGetParameters();
    }
  }
  return { ...actual, FoxgloveClient: MockFoxgloveClient };
});

function emit(event: string, ...args: unknown[]): void {
  mockHandlers.get(event)!(...args);
}

function serverInfo(sessionId: string, capabilities: string[] = []) {
  return { name: "server", capabilities, supportedEncodings: [], sessionId };
}

function createPlayer(): FoxgloveWebSocketPlayer {
  return new FoxgloveWebSocketPlayer({
    url: "ws://localhost:8765",
    metricsCollector: new NoopMetricsCollector(),
    sourceId: "test",
  });
}

describe("FoxgloveWebSocketPlayer", () => {
  beforeEach(() => {
    mockHandlers.clear();
    mockGetParameters.mockClear();
    (global as { WebSocket: unknown }).WebSocket = jest.fn();
  });

  it("keeps datatypes of advertised channels when the server starts a new session", async () => {
    // Given a connected player with an advertised channel
    const states: PlayerState[] = [];
    const player = createPlayer();
    player.setListener(async (state) => {
      states.push(state);
    });
    emit("open");
    emit("serverInfo", serverInfo("session-1"));
    emit("advertise", [
      {
        id: 1,
        topic: "/foo",
        encoding: "json",
        schemaName: "Foo",
        schema: JSON.stringify({ type: "object", properties: { value: { type: "number" } } }),
      },
    ]);

    // When the server sends a new serverInfo (e.g. looping playback) without re-advertising
    emit("serverInfo", serverInfo("session-2"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Then the channel's schema is still available
    const activeData = states.at(-1)?.activeData;
    expect(activeData?.topics).toEqual([{ name: "/foo", schemaName: "Foo" }]);
    expect(activeData?.datatypes.has("Foo")).toBe(true);

    player.close();
  });

  it("polls parameters with a single interval when the server starts a new session", () => {
    // Given a connected player whose server supports parameters
    jest.useFakeTimers();
    const player = createPlayer();
    emit("open");
    emit("serverInfo", serverInfo("session-1", ["parameters"]));

    // When the server sends a new serverInfo (e.g. looping playback)
    emit("serverInfo", serverInfo("session-2", ["parameters"]));
    mockGetParameters.mockClear();
    jest.advanceTimersByTime(GET_ALL_PARAMS_PERIOD_MS);

    // Then only one interval polls, and it stops when the player closes
    expect(mockGetParameters).toHaveBeenCalledTimes(1);
    player.close();
    jest.advanceTimersByTime(GET_ALL_PARAMS_PERIOD_MS);
    expect(mockGetParameters).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
