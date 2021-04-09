// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// A wrapper for Worker that makes it act like a SharedWorker. We are temporarily migrating off of
// SharedWorker since it doesn't work properly with Electron ASAR archives:
// https://github.com/electron/electron/issues/28572
export default class NotActuallySharedWorker {
  readonly port: MessagePort;
  onerror?: (event: ErrorEvent) => void;
  constructor(worker: Worker) {
    const channel = new MessageChannel();
    this.port = channel.port1;
    channel.port2.onmessage = (event) => worker.postMessage(event.data);
    worker.onmessage = (event) => channel.port2.postMessage(event.data);
    worker.onerror = (event) => this.onerror?.(event);
  }
}

declare let DedicatedWorkerGlobalScope: any;

// Call this from the worker code to set up the global environment so it can be used like SharedWorkerGlobalScope.
export function initializeNotActuallySharedWorker(): void {
  if (
    typeof DedicatedWorkerGlobalScope === "undefined" ||
    !(self instanceof DedicatedWorkerGlobalScope)
  ) {
    throw new Error("Trying to initialize NotActuallySharedWorker outside of a Worker?");
  }

  Object.defineProperty(self, "onconnect", {
    set(callback) {
      const channel = new MessageChannel();
      channel.port2.onmessage = (event) => (self as any).postMessage(event.data);
      self.onmessage = (event: any) => channel.port2.postMessage(event.data);
      callback({ ports: [channel.port1] });
    },
  });
}
