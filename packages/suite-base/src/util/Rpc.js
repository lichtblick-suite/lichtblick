// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
var _a;
const RESPONSE = "$$RESPONSE";
const ERROR = "$$ERROR";
// helper function to create linked channels for testing
export function createLinkedChannels() {
    const local = {
        onmessage: undefined,
        postMessage(data, _transfer) {
            const ev = new MessageEvent("message", { data });
            if (remote.onmessage) {
                remote.onmessage(ev);
            }
        },
        terminate: () => {
            // no-op
        },
    };
    const remote = {
        onmessage: undefined,
        postMessage(data, _transfer) {
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
class Rpc {
    static transferables = "$$TRANSFERABLES";
    #channel;
    #messageId = 0;
    #pendingCallbacks = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    #receivers = new Map();
    constructor(channel) {
        this.#channel = channel;
        if (this.#channel.onmessage) {
            throw new Error("channel.onmessage is already set. Can only use one Rpc instance per channel.");
        }
        this.#channel.onmessage = this.#onChannelMessage;
    }
    #onChannelMessage = (ev) => {
        const { id, topic, data } = ev.data;
        if (topic === RESPONSE) {
            this.#pendingCallbacks[id]?.(ev.data);
            delete this.#pendingCallbacks[id];
            return;
        }
        // invoke the receive handler in a promise so if it throws synchronously we can reject
        new Promise((resolve) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const handler = this.#receivers.get(topic);
            if (!handler) {
                throw new Error(`no receiver registered for ${topic}`);
            }
            // This works both when `handler` returns a value or a Promise.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            resolve(handler(data));
        })
            .then((result) => {
            if (!result) {
                this.#channel.postMessage({ topic: RESPONSE, id });
                return;
            }
            const transferables = result[_a.transferables];
            delete result[_a.transferables];
            const message = {
                topic: RESPONSE,
                id,
                data: result,
            };
            this.#channel.postMessage(message, transferables);
        })
            .catch((e) => {
            const err = e;
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
            this.#channel.postMessage(message);
        });
    };
    /** Call this when the channel has been terminated to reject any outstanding send callbacks. */
    terminate() {
        for (const [id, callback] of Object.entries(this.#pendingCallbacks)) {
            callback({
                topic: RESPONSE,
                id,
                data: {
                    [ERROR]: true,
                    name: "Error",
                    message: "Rpc terminated",
                    stack: new Error().stack,
                },
            });
        }
    }
    // send a message across the rpc boundary to a receiver on the other side
    // this returns a promise for the receiver's response.  If there is no registered
    // receiver for the given topic, this method throws
    async send(topic, data, transfer) {
        const id = this.#messageId++;
        const message = { topic, id, data };
        const result = new Promise((resolve, reject) => {
            this.#pendingCallbacks[id] = (info) => {
                if (info.data?.[ERROR] != undefined) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    const error = new Error(info.data.message);
                    error.name = info.data.name;
                    error.stack = info.data.stack;
                    reject(error);
                }
                else {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    resolve(info.data);
                }
            };
        });
        this.#channel.postMessage(message, transfer);
        return await result;
    }
    // register a receiver for a given message on a topic
    // only one receiver can be registered per topic and currently
    // 'deregistering' a receiver is not supported since this is not common
    receive(topic, handler) {
        if (this.#receivers.has(topic)) {
            throw new Error(`Receiver already registered for topic: ${topic}`);
        }
        this.#receivers.set(topic, handler);
    }
}
_a = Rpc;
export default Rpc;
