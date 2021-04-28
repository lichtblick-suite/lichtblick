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

import { Time } from "rosbag";

import {
  DataProviderDescriptor,
  ExtensionPoint,
  GetMessagesResult,
  GetMessagesTopics,
  InitializationResult,
  DataProvider,
} from "@foxglove-studio/app/dataProviders/types";
import Rpc from "@foxglove-studio/app/util/Rpc";
import { setupMainThreadRpc } from "@foxglove-studio/app/util/RpcMainThreadUtils";

// Looks a bit like a regular `DataProvider`, but is not intended to be used directly in a
// DataProviderDescriptor tree, but rather in another DataProvider where we instantiate an Rpc, e.g.
// in a WorkerDataProvider, or even over a WebSocket. It proxies any calls to the
// RpcDataProviderRemote, where we instantiate the rest of the DataProviderDescriptor tree.
// See WorkerDataProvider for an example.
export default class RpcDataProvider implements DataProvider {
  _rpc: Rpc;
  _childDescriptor: DataProviderDescriptor;

  constructor(rpc: Rpc, children: DataProviderDescriptor[]) {
    this._rpc = rpc;
    setupMainThreadRpc(this._rpc);
    const child = children[0];
    if (children.length !== 1 || !child) {
      throw new Error(`RpcDataProvider requires exactly 1 child, but received ${children.length}`);
    }
    this._childDescriptor = child;
  }

  initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    const { progressCallback, reportMetadataCallback } = extensionPoint;

    this._rpc.receive("extensionPointCallback", ({ type, data }: any) => {
      switch (type) {
        case "progressCallback":
          progressCallback(data);
          break;
        case "reportMetadataCallback":
          reportMetadataCallback(data);
          break;
        default:
          throw new Error(`Unsupported extension point type in RpcDataProvider: ${type}`);
      }
      return undefined;
    });
    return this._rpc.send("initialize", { childDescriptor: this._childDescriptor });
  }

  async getMessages(start: Time, end: Time, topics: GetMessagesTopics): Promise<GetMessagesResult> {
    if (topics.parsedMessages) {
      throw new Error("RpcDataProvider only supports rosBinaryMessages");
    }
    const rpcRes = await this._rpc.send("getMessages", {
      start,
      end,
      topics: topics.rosBinaryMessages,
    });
    return {
      rosBinaryMessages: (rpcRes as any).messages,
      parsedMessages: undefined,
    };
  }

  close(): Promise<void> {
    return this._rpc.send("close");
  }
}
