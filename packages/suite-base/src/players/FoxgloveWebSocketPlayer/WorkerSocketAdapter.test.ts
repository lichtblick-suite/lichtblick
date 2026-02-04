// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { FromWorkerMessage } from "@lichtblick/suite-base/players/FoxgloveWebSocketPlayer/types";
import { BasicBuilder } from "@lichtblick/test-builders";

import WorkerSocketAdapter from "./WorkerSocketAdapter";

describe("WorkerSocketAdapter", () => {
  let workerMock: any;
  const wsUrl = "wss://example.com";

  beforeEach(() => {
    workerMock = {
      postMessage: jest.fn(),
      terminate: jest.fn(),
      onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    };

    global.Worker = jest.fn(() => workerMock as unknown as Worker);

    new WorkerSocketAdapter(wsUrl);
  });

  it("WorkerSocketAdapter should close a WebSocket connection", () => {
    workerMock.onmessage?.({ data: { type: "close", data: {} } } as MessageEvent);

    expect(workerMock.terminate).toHaveBeenCalled();
  });

  it("WorkerSocketAdapter should send a message", () => {
    const socket = new WorkerSocketAdapter(wsUrl);
    const message = BasicBuilder.string();

    socket.send(message);

    expect(workerMock.postMessage).toHaveBeenCalledWith({
      type: "data",
      data: message,
    });
  });

  it("WorkerSocketAdapter should handle an error", () => {
    workerMock.onmessage?.({
      data: { type: "error", error: "Something went wrong" },
    } as MessageEvent);

    expect(workerMock.postMessage).toHaveBeenCalledWith({
      type: "open",
      data: { wsUrl, protocols: undefined },
    });
  });

  it.each([
    [
      {
        data: { type: "open", protocol: BasicBuilder.string() },
      } as MessageEvent<FromWorkerMessage>,
    ],
    [{ data: { type: "message", data: BasicBuilder.string() } } as MessageEvent<FromWorkerMessage>],
    [{ data: { type: "close", data: undefined } } as MessageEvent<FromWorkerMessage>],
  ])("WorkerSocketAdapter should handle '%s' event", (event) => {
    workerMock.onmessage?.(event);
    expect(workerMock.postMessage).toHaveBeenCalledWith({
      type: "open",
      data: { wsUrl, protocols: undefined },
    });
  });
});
