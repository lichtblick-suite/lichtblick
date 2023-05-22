// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type ToWorkerMessage =
  | { type: "open"; data: { wsUrl: string; protocols?: string[] | string } }
  | { type: "close"; data: undefined }
  | { type: "data"; data: string | ArrayBuffer | ArrayBufferView };

export type FromWorkerMessage =
  | { type: "open"; protocol: string }
  | { type: "close"; data: unknown }
  | { type: "error"; error: unknown }
  | { type: "message"; data: unknown };

let ws: WebSocket | undefined = undefined;

const send = (msg: FromWorkerMessage): void => {
  self.postMessage(msg);
};

self.onmessage = (event: MessageEvent<ToWorkerMessage>) => {
  const { type, data } = event.data;
  switch (type) {
    case "open":
      try {
        ws = new WebSocket(data.wsUrl, data.protocols);
        ws.binaryType = "arraybuffer";
        ws.onerror = (wsEvent) => {
          send({
            type: "error",
            error: (wsEvent as unknown as { error: Error }).error,
          });
        };
        ws.onopen = (_event) => {
          send({
            type: "open",
            protocol: ws!.protocol,
          });
        };
        ws.onclose = (wsEvent) => {
          send({ type: "close", data: JSON.parse(JSON.stringify(wsEvent) ?? "{}") });
        };
        ws.onmessage = (wsEvent: MessageEvent) => {
          send({
            type: "message",
            data: wsEvent.data,
          });
        };
      } catch (err) {
        // try-catch is needed to catch `Mixed Content` errors in Chrome, where the client
        // attempts to load `ws://` from `https://`. (Safari would catch these in `ws.onerror`
        // but with `undefined` as an error.)
        send({
          type: "error",
          error: err ?? { message: "Insecure WebSocket connection" },
        });
      }
      break;
    case "close":
      ws?.close();
      break;
    case "data":
      ws?.send(data);
      break;
  }
};
