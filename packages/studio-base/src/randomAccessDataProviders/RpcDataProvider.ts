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

import { Time } from "@foxglove/rostime";
import {
  RandomAccessDataProviderDescriptor,
  ExtensionPoint,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
  RandomAccessDataProvider,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import Rpc from "@foxglove/studio-base/util/Rpc";
import { setupMainThreadRpc } from "@foxglove/studio-base/util/RpcMainThreadUtils";

// Looks a bit like a regular `RandomAccessDataProvider`, but is not intended to be used directly in a
// RandomAccessDataProviderDescriptor tree, but rather in another RandomAccessDataProvider where we instantiate an Rpc, e.g.
// in a WorkerDataProvider, or even over a WebSocket. It proxies any calls to the
// RpcDataProviderRemote, where we instantiate the rest of the RandomAccessDataProviderDescriptor tree.
// See WorkerDataProvider for an example.
export default class RpcDataProvider implements RandomAccessDataProvider {
  private _rpc: Rpc;
  private _childDescriptor: RandomAccessDataProviderDescriptor;

  constructor(rpc: Rpc, children: RandomAccessDataProviderDescriptor[]) {
    this._rpc = rpc;
    setupMainThreadRpc(this._rpc);
    const child = children[0];
    if (children.length !== 1 || !child) {
      throw new Error(`RpcDataProvider requires exactly 1 child, but received ${children.length}`);
    }
    this._childDescriptor = child;
  }

  async initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    const { progressCallback, reportMetadataCallback } = extensionPoint;

    type ExtensionPointParams<K> = K extends keyof ExtensionPoint
      ? { type: K; data: Parameters<ExtensionPoint[K]>[0] }
      : never;
    this._rpc.receive(
      "extensionPointCallback",
      (value: ExtensionPointParams<keyof ExtensionPoint>) => {
        switch (value.type) {
          case "progressCallback":
            progressCallback(value.data);
            break;
          case "reportMetadataCallback":
            reportMetadataCallback(value.data);
            break;
          default:
            throw new Error(
              `Unsupported extension point type in RpcDataProvider: ${
                (value as ExtensionPointParams<keyof ExtensionPoint>).type
              }`,
            );
        }
        return undefined;
      },
    );
    return await this._rpc.send("initialize", { childDescriptor: this._childDescriptor });
  }

  async getMessages(start: Time, end: Time, topics: GetMessagesTopics): Promise<GetMessagesResult> {
    if (topics.parsedMessages) {
      throw new Error("RpcDataProvider only supports rosBinaryMessages");
    }
    const rpcRes = await this._rpc.send<{ messages: GetMessagesResult["rosBinaryMessages"] }>(
      "getMessages",
      {
        start,
        end,
        topics: topics.rosBinaryMessages,
      },
    );
    return {
      rosBinaryMessages: rpcRes.messages,
      parsedMessages: undefined,
    };
  }

  async close(): Promise<void> {
    return await this._rpc.send("close");
  }
}
