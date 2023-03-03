// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IWebSocket } from "@foxglove/ws-protocol";

import { FromWorkerMessage, ToWorkerMessage } from "./worker";

export default class WorkerSocketAdapter implements IWebSocket {
  private worker: Worker;
  public binaryType: string = "";
  public protocol: string = "";
  public onerror: ((event: unknown) => void) | undefined = undefined;
  public onopen: ((event: unknown) => void) | undefined = undefined;
  public onclose: ((event: unknown) => void) | undefined = undefined;
  public onmessage: ((event: unknown) => void) | undefined = undefined;

  public constructor(wsUrl: string, protocols?: string[] | string) {
    // foxglove-depcheck-used: babel-plugin-transform-import-meta
    this.worker = new Worker(new URL("./worker", import.meta.url));
    this.sendToWorker({ type: "open", data: { wsUrl, protocols } });

    this.worker.onerror = (ev) => {
      if (this.onerror) {
        this.onerror(ev);
      }
    };

    this.worker.onmessage = (event: MessageEvent<FromWorkerMessage>) => {
      switch (event.data.type) {
        case "open":
          if (this.onopen) {
            this.protocol = event.data.protocol;
            this.onopen(event.data);
          }
          break;
        case "close":
          if (this.onclose) {
            this.onclose(event.data);
          }
          break;
        case "error":
          if (this.onerror) {
            this.onerror(event.data);
          }
          break;
        case "message":
          if (this.onmessage) {
            this.onmessage(event.data);
          }
          break;
      }
    };
  }

  public close(): void {
    this.sendToWorker({
      type: "close",
      data: undefined,
    });
    this.worker.terminate();
  }

  public send(data: string | ArrayBuffer | ArrayBufferView): void {
    this.sendToWorker({ type: "data", data });
  }

  private sendToWorker(msg: ToWorkerMessage): void {
    this.worker.postMessage(msg);
  }
}
