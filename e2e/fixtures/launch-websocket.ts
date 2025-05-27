// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { FoxgloveServer } from "@foxglove/ws-protocol";
import { WebSocketServer } from "ws";

export type WebsocketTest = {
  close: () => Promise<unknown>;
};

/**
 * Launch a simulation of a websocket server, using real use case.
 *
 * @returns A close function to exit the websocket server.
 */
export function launchWebsocket(): WebsocketTest {
  function getTimestamp() {
    const now = Date.now();
    return {
      sec: Math.floor(now / 1000),
      nsec: (now % 1000) * 1e6,
    };
  }

  const server = new FoxgloveServer({ name: "websocket-test-server" });

  const ws = new WebSocketServer({
    port: 8765,
    handleProtocols: (protocols) => server.handleProtocols(protocols),
  });

  ws.on("listening", () => {
    console.debug("server listening on %s", ws.address());
  });

  ws.on("message", (message) => {
    console.debug("message -> ", message);
  });

  ws.on("connection", (conn, req) => {
    const name = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
    console.debug("connection from %s via %s", name, req.url);
    server.handleConnection(conn, name);
  });

  server.on("subscribe", (chanId) => {
    console.debug("first client subscribed to %d", chanId);
  });

  server.on("error", (err) => {
    console.error("server error: %o", err);
  });

  const textEncoder = new TextEncoder();

  const channel = server.addChannel({
    topic: "/websocket_test",
    encoding: "json",
    schemaName: "websocket_test",
    schema: JSON.stringify({
      type: "object",
      properties: {
        hello: { type: "string" },
        fo: { type: "number" },
      },
    }),
  });

  const intervalId = setInterval(() => {
    const testMessage = {
      timestamp: getTimestamp(),
      data: {
        hello: "world",
        foo: 42,
      },
    };

    server.sendMessage(
      channel,
      BigInt(Date.now()) * 1_000_000n,
      textEncoder.encode(JSON.stringify(testMessage)),
    );
  }, 500);

  async function close() {
    clearInterval(intervalId);

    // Close all active connections
    ws.clients.forEach((client) => {
      client.terminate(); // Forcefully close all client connections
    });

    return await new Promise((resolve, reject) => {
      ws.close((err) => {
        if (err) {
          console.error("Error closing WebSocket server: %o", err);
          reject(err);
          return;
        }
        resolve(undefined);
      });
    });
  }

  return {
    close,
  };
}
