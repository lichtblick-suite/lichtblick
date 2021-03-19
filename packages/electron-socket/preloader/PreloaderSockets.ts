// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Cloneable, RpcCall } from "../shared/Rpc";
import { createServer, createSocket } from "./api";

export class PreloaderSockets {
  // The preloader ("isolated world") side of the original message channel
  // connecting to the renderer ("main world"). Function calls such as
  // createSocket() and createServer() come in on this channel, and function
  // call return values are sent back over it
  #messagePort: MessagePort;
  // The API exposed to the renderer
  #functionHandlers = new Map<string, (callId: number, args: Cloneable[]) => void>([
    [
      "createSocket",
      (callId, args) => {
        const transformName = args[0] as string | undefined;
        const port = createSocket(transformName);
        this.#messagePort.postMessage([callId], [port]);
      },
    ],
    [
      "createServer",
      (callId, args) => {
        const transformName = args[0] as string | undefined;
        const port = createServer(transformName);
        this.#messagePort.postMessage([callId], [port]);
      },
    ],
  ]);

  // A map of created `PreloaderSockets` instances
  static registeredSockets = new Map<string, PreloaderSockets>();

  constructor(messagePort: MessagePort) {
    this.#messagePort = messagePort;

    messagePort.onmessage = (ev: MessageEvent<RpcCall>) => {
      const methodName = ev.data[0];
      const callId = ev.data[1];
      const handler = this.#functionHandlers.get(methodName);
      if (handler == undefined) {
        this.#messagePort.postMessage([callId, `unhandled method "${methodName}"`]);
        return;
      }

      const args = ev.data.slice(2) as Cloneable[];
      handler(callId, args);
    };
    messagePort.start();
  }

  static async Create(channel: string = "__electron_socket"): Promise<PreloaderSockets> {
    const windowLoaded = new Promise<void>((resolve) => {
      if (document.readyState === "complete") {
        resolve();
        return;
      }
      const loaded = () => {
        window.removeEventListener("load", loaded);
        resolve();
      };
      window.addEventListener("load", loaded);
    });

    await windowLoaded;

    const entry = PreloaderSockets.registeredSockets.get(channel);
    if (entry) {
      return entry;
    }

    const messageChannel = new MessageChannel();
    const sockets = new PreloaderSockets(messageChannel.port2);
    PreloaderSockets.registeredSockets.set(channel, sockets);
    window.postMessage(channel, "*", [messageChannel.port1]);
    return sockets;
  }
}
