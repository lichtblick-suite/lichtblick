// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { FoxgloveClient } from "@foxglove/ws-protocol";

import NoopMetricsCollector from "@lichtblick/suite-base/players/NoopMetricsCollector";
import { BasicBuilder } from "@lichtblick/test-builders";

import FoxgloveWebSocketPlayer from "./index";

type Handler = (...args: unknown[]) => void;

type MockClient = {
  emit: (event: string, ...args: unknown[]) => void;
  sendServiceCallRequest: jest.Mock;
  fetchAsset: jest.Mock;
};

jest.mock("@foxglove/ws-protocol", () => {
  const actual = jest.requireActual<Record<string, unknown>>("@foxglove/ws-protocol");
  class MockFoxgloveClient {
    public static SUPPORTED_SUBPROTOCOL = "foxglove.websocket.v1";
    public static instances: MockFoxgloveClient[] = [];
    public sendServiceCallRequest = jest.fn();
    public fetchAsset = jest.fn();
    public close = jest.fn();
    public subscribe = jest.fn();
    public unsubscribe = jest.fn();
    readonly #handlers = new Map<string, Handler>();

    public constructor() {
      MockFoxgloveClient.instances.push(this);
    }

    public on(event: string, handler: Handler): void {
      this.#handlers.set(event, handler);
    }

    public emit(event: string, ...args: unknown[]): void {
      this.#handlers.get(event)?.(...args);
    }
  }
  return { ...actual, FoxgloveClient: MockFoxgloveClient };
});

class MockWebSocket {
  public close = jest.fn();
}

function latestClient(): MockClient {
  const instances = (FoxgloveClient as unknown as { instances: MockClient[] }).instances;
  return instances[instances.length - 1]!;
}

const SERVICE_NAME = "/trigger";
const SERVICE_ID = 1;
const OBJECT_SCHEMA = JSON.stringify({ type: "object", properties: {} });

function connectWithService(client: MockClient, capabilities: string[] = ["services"]): void {
  client.emit("open");
  client.emit("serverInfo", {
    op: "serverInfo",
    name: BasicBuilder.string(),
    capabilities,
    supportedEncodings: ["json"],
  });
  client.emit("advertiseServices", [
    {
      id: SERVICE_ID,
      name: SERVICE_NAME,
      type: "std_srvs/Trigger",
      request: {
        encoding: "json",
        schemaName: "Request",
        schemaEncoding: "jsonschema",
        schema: OBJECT_SCHEMA,
      },
      response: {
        encoding: "json",
        schemaName: "Response",
        schemaEncoding: "jsonschema",
        schema: OBJECT_SCHEMA,
      },
    },
  ]);
}

function sentCallId(client: MockClient): number {
  return (client.sendServiceCallRequest.mock.calls[0]![0] as { callId: number }).callId;
}

describe("FoxgloveWebSocketPlayer", () => {
  let player: FoxgloveWebSocketPlayer;

  beforeEach(() => {
    jest.useFakeTimers();
    jest
      .spyOn(globalThis, "WebSocket", "get")
      .mockReturnValue(MockWebSocket as unknown as typeof WebSocket);
    player = new FoxgloveWebSocketPlayer({
      url: `ws://localhost:${BasicBuilder.number({ min: 1024, max: 65535 })}`,
      metricsCollector: new NoopMetricsCollector(),
      sourceId: BasicBuilder.string(),
    });
  });

  afterEach(() => {
    player.close();
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe("callService", () => {
    it("should resolve with the response when the server answers the call", async () => {
      // Given
      const client = latestClient();
      connectWithService(client);
      const result = player.callService(SERVICE_NAME, {});

      // When
      client.emit("serviceCallResponse", {
        op: 3,
        serviceId: SERVICE_ID,
        callId: sentCallId(client),
        encoding: "json",
        data: new DataView(new TextEncoder().encode('{"success":true}').buffer),
      });

      // Then
      await expect(result).resolves.toEqual({ success: true });
    });

    it("should reject with the server message when the server reports a service call failure", async () => {
      // Given
      const client = latestClient();
      connectWithService(client);
      const result = player.callService(SERVICE_NAME, {});
      const message = BasicBuilder.string();

      // When
      client.emit("serviceCallFailure", {
        op: "serviceCallFailure",
        serviceId: SERVICE_ID,
        callId: sentCallId(client),
        message,
      });

      // Then
      await expect(result).rejects.toThrow(message);
    });

    it("should reject pending calls when the connection closes", async () => {
      // Given
      const client = latestClient();
      connectWithService(client);
      const result = player.callService(SERVICE_NAME, {});

      // When
      client.emit("close", {});

      // Then
      await expect(result).rejects.toThrow("connection closed");
    });

    it("should keep a pending call when an asset response with the same id arrives", async () => {
      // Given
      const client = latestClient();
      connectWithService(client, ["services", "assets"]);
      const result = player.callService(SERVICE_NAME, {});
      const callId = sentCallId(client);
      const asset = player.fetchAsset(`package://${BasicBuilder.string()}`);
      const requestId = (client.fetchAsset.mock.calls[0]![1] as number | undefined) ?? callId;

      // When
      client.emit("fetchAssetResponse", {
        op: 4,
        requestId,
        status: 0,
        data: new DataView(new Uint8Array([1]).buffer),
      });
      await asset;
      client.emit("serviceCallResponse", {
        op: 3,
        serviceId: SERVICE_ID,
        callId,
        encoding: "json",
        data: new DataView(new TextEncoder().encode('{"success":true}').buffer),
      });

      // Then
      await expect(result).resolves.toEqual({ success: true });
    });
  });
});
