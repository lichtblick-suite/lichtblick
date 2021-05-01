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

import Rpc from "@foxglove-studio/app/util/Rpc";

class FakeRpc {
  proxiedWorker?: FakeRpc;
  handlers: {
    [key: string]: (arg0: any) => any;
  } = {};

  async send<TResult>(topic: string, data?: any, _transfer?: any[]): Promise<TResult> {
    return this.proxiedWorker?.handlers[topic]?.(data);
  }

  async receive<T, TOut>(topic: string, handler: (arg0: T) => TOut) {
    if (this.handlers[topic]) {
      throw new Error(`Cannot call receive twice for topic: ${topic}`);
    }
    this.handlers[topic] = handler;
  }
}

export function getFakeRpcs(): { workerRpc: FakeRpc; mainThreadRpc: FakeRpc } {
  const workerRpc = new FakeRpc();
  const mainThreadRpc = new FakeRpc();
  workerRpc.proxiedWorker = mainThreadRpc;
  mainThreadRpc.proxiedWorker = workerRpc;
  return { workerRpc, mainThreadRpc };
}

export type RpcLike = Rpc | FakeRpc;
