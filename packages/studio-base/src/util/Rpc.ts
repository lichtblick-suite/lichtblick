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

// this type mirrors the MessageChannel and MessagePort APIs which are available on
// instances of web-workers and shared-workers respectively, as well as avaiable on
// 'global' within them.
export interface Channel {
  postMessage(data: unknown, transfer?: (Transferable | OffscreenCanvas)[]): void;
  onmessage?: ((ev: MessageEvent) => unknown) | null; // eslint-disable-line no-restricted-syntax
  terminate: () => void;
}

const RESPONSE = "$$RESPONSE";
const ERROR = "$$ERROR";

// helper function to create linked channels for testing
export function createLinkedChannels(): { local: Channel; remote: Channel } {
  const local: Channel = {
    onmessage: undefined,

    postMessage(data: unknown, _transfer?: Array<ArrayBuffer>) {
      const ev = new MessageEvent("message", { data });
      if (remote.onmessage) {
        remote.onmessage(ev);
      }
    },
    terminate: () => {
      // no-op
    },
  };

  const remote: Channel = {
    onmessage: undefined,

    postMessage(data: unknown, _transfer?: Array<ArrayBuffer>) {
      const ev = new MessageEvent("message", { data });
      if (local.onmessage) {
        local.onmessage(ev);
      }
    },
    terminate: () => {
      // no-op
    },
  };
  return { local, remote };
}

// This class allows you to hook up bi-directional async calls across web-worker
// boundaries where a single call to or from a worker can 'wait' on the response.
// Errors in receivers are propigated back to the caller as a rejection.
// It also supports returning transferables over the web-worker postMessage api,
// which was the main shortcomming with the worker-rpc npm module.
// To attach rpc to an instance of a worker in the main thread:
//   const rpc = new Rpc(workerInstace);
// To attach rpc within an a web worker:
//   const rpc = new Rpc(global);
// Check out the tests for more examples.
export default class Rpc {
  static transferables = "$$TRANSFERABLES";
  private _channel: Omit<Channel, "terminate">;
  private _messageId: number = 0;
  private _pendingCallbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: number]: (arg0: any) => void;
  } = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _receivers: Map<string, (arg0: any) => any> = new Map();

  constructor(channel: Omit<Channel, "terminate">) {
    this._channel = channel;
    if (this._channel.onmessage) {
      throw new Error(
        "channel.onmessage is already set. Can only use one Rpc instance per channel.",
      );
    }
    this._channel.onmessage = this._onChannelMessage;
  }

  private _onChannelMessage = (ev: MessageEvent): void => {
    const { id, topic, data } = ev.data;
    if (topic === RESPONSE) {
      this._pendingCallbacks[id]?.(ev.data);
      delete this._pendingCallbacks[id];
      return;
    }
    // invoke the receive handler in a promise so if it throws synchronously we can reject
    new Promise<Record<string, Transferable[] | undefined> | undefined>((resolve) => {
      const handler = this._receivers.get(topic);
      if (!handler) {
        throw new Error(`no receiver registered for ${topic}`);
      }
      // This works both when `handler` returns a value or a Promise.
      resolve(handler(data));
    })
      .then((result) => {
        if (!result) {
          return this._channel.postMessage({ topic: RESPONSE, id });
        }
        const transferables = result[Rpc.transferables];
        delete result[Rpc.transferables];
        const message = {
          topic: RESPONSE,
          id,
          data: result,
        };
        this._channel.postMessage(message, transferables);
      })
      .catch((err) => {
        const message = {
          topic: RESPONSE,
          id,
          data: {
            [ERROR]: true,
            name: err.name,
            message: err.message,
            stack: err.stack,
          },
        };
        this._channel.postMessage(message);
      });
  };

  // send a message across the rpc boundary to a receiver on the other side
  // this returns a promise for the receiver's response.  If there is no registered
  // receiver for the given topic, this method throws
  async send<TResult>(
    topic: string,
    data?: unknown,
    transfer?: (Transferable | OffscreenCanvas)[],
  ): Promise<TResult> {
    const id = this._messageId++;
    const message = { topic, id, data };
    const result = new Promise<TResult>((resolve, reject) => {
      this._pendingCallbacks[id] = (info) => {
        if (info.data?.[ERROR] != undefined) {
          const error = new Error(info.data.message);
          error.name = info.data.name;
          error.stack = info.data.stack;
          reject(error);
        } else {
          resolve(info.data);
        }
      };
    });
    this._channel.postMessage(message, transfer);
    return await result;
  }

  // register a receiver for a given message on a topic
  // only one receiver can be registered per topic and currently
  // 'deregistering' a receiver is not supported since this is not common
  receive<T, TOut>(topic: string, handler: (arg0: T) => TOut): void {
    if (this._receivers.has(topic)) {
      throw new Error(`Receiver already registered for topic: ${topic}`);
    }
    this._receivers.set(topic, handler);
  }
}
