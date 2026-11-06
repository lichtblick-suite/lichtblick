/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { FoxgloveClient } from "@foxglove/ws-protocol";

import { MessageEvent } from "@lichtblick/suite";
import NoopMetricsCollector from "@lichtblick/suite-base/players/NoopMetricsCollector";

import FoxgloveWebSocketPlayer from ".";

jest.mock("@foxglove/ws-protocol", () => ({
  ...jest.requireActual("@foxglove/ws-protocol"),
  FoxgloveClient: jest.fn(),
}));

it("subscribes to independent channels sharing a topic and preserves selection across advertisements", async () => {
  const socket = jest.spyOn(globalThis, "WebSocket").mockImplementation(() => ({}) as WebSocket);
  const callbacks = new Map<string, (event?: unknown) => void>();
  const client = {
    on: jest.fn((name: string, callback: (event?: unknown) => void) =>
      callbacks.set(name, callback),
    ),
    subscribe: jest.fn((id: number) => id + 100),
    unsubscribe: jest.fn(),
    close: jest.fn(),
  };
  jest.mocked(FoxgloveClient).mockImplementation(() => client as unknown as FoxgloveClient);
  const player = new FoxgloveWebSocketPlayer({
    url: "ws://example.invalid",
    sourceId: "test",
    metricsCollector: new NoopMetricsCollector(),
  });
  try {
    const messages: MessageEvent[] = [];
    player.setListener(async (state) => {
      messages.push(...(state.activeData?.messages ?? []));
    });
    callbacks.get("open")!();
    player.setSubscriptions([{ topic: "/shared" }]);
    const channel = {
      id: 1,
      topic: "/shared",
      encoding: "json",
      schemaName: "Message",
      schema: '{"type":"object","properties":{"value":{"type":"number"}}}',
    };
    callbacks.get("advertise")!([channel]);
    callbacks.get("advertise")!([{ ...channel, id: 2 }]);
    expect(client.subscribe.mock.calls).toEqual([[1], [2]]);

    const data = new DataView(new TextEncoder().encode('{"value":42}').buffer);
    callbacks.get("message")!({ subscriptionId: 102, data });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(messages.map((message) => message.channelId)).toEqual(["websocket:2"]);

    player.setSubscriptions([{ topic: "/shared", channelIds: ["websocket:2"] }]);
    expect(client.unsubscribe.mock.calls).toEqual([[101]]);
    callbacks.get("unadvertise")!([1]);
    expect(client.unsubscribe.mock.calls).toEqual([[101]]);
    player.setSubscriptions([{ topic: "/shared", channelIds: ["missing"] }]);
    expect(client.unsubscribe.mock.calls).toEqual([[101], [102]]);
    expect(client.subscribe).toHaveBeenCalledTimes(2);
  } finally {
    player.close();
    socket.mockRestore();
  }
});
