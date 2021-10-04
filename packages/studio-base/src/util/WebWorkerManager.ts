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

import findIndex from "lodash/findIndex";
import sortBy from "lodash/sortBy";

import Rpc, { Channel } from "@foxglove/studio-base/util/Rpc";
import { setupMainThreadRpc } from "@foxglove/studio-base/util/RpcMainThreadUtils";

// This file provides a convenient way to set up and tear down workers as needed. It will create only a single worker
// of each class, and terminate the worker when all listeners are unregistered.

type WorkerListenerState<W> = { rpc: Rpc; worker: W; listenerIds: string[] };

export default class WebWorkerManager<W extends Channel> {
  private _createWorker: () => W;
  private _maxWorkerCount: number;
  private _workerStates: (WorkerListenerState<W> | undefined)[];
  private _allListeners: Set<string>;

  constructor(createWorker: () => W, maxWorkerCount: number) {
    this._createWorker = createWorker;
    this._maxWorkerCount = maxWorkerCount;
    this._workerStates = new Array(maxWorkerCount);
    this._allListeners = new Set();
  }

  testing_workerCount(): number {
    return this._workerStates.filter(Boolean).length;
  }

  testing_getWorkerState(id: string): WorkerListenerState<W> | undefined {
    return this._workerStates.find((workerState) => workerState?.listenerIds.includes(id));
  }

  registerWorkerListener(id: string): Rpc {
    if (this._allListeners.has(id)) {
      throw new Error("cannot register the same listener id twice");
    }
    this._allListeners.add(id);

    const currentWorkerCount = this._workerStates.filter(Boolean).length;
    if (currentWorkerCount < this._maxWorkerCount) {
      const worker = this._createWorker();
      const rpc = new Rpc(worker);
      setupMainThreadRpc(rpc);

      const emptyIndex = findIndex(this._workerStates, (x) => !x);
      this._workerStates[emptyIndex] = { worker, rpc, listenerIds: [id] };
      return rpc;
    }
    const workerStateByListenerCount = sortBy(
      this._workerStates.filter(Boolean),
      (workerState) => workerState?.listenerIds.length,
    );
    const workerState = workerStateByListenerCount[0];
    if (!workerState) {
      throw new Error("no worker state");
    }
    workerState.listenerIds.push(id);
    return workerState.rpc;
  }

  unregisterWorkerListener(id: string): void {
    if (!this._allListeners.has(id)) {
      throw new Error("Cannot find listener to unregister");
    }
    this._allListeners.delete(id);

    const workerStateIndex = findIndex(this._workerStates, (workerState) => {
      if (!workerState) {
        return false;
      }
      return workerState.listenerIds.includes(id);
    });
    const workerState = this._workerStates[workerStateIndex];
    if (workerStateIndex >= 0 && workerState) {
      workerState.listenerIds = workerState.listenerIds.filter((_id) => _id !== id);
      if (workerState.listenerIds.length === 0) {
        this._workerStates[workerStateIndex] = undefined;
        workerState.worker.terminate();
      }
    }
  }
}
