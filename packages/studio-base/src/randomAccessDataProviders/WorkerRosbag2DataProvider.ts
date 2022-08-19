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
import { Options } from "@foxglove/studio-base/randomAccessDataProviders/Rosbag2DataProvider";
import Rpc from "@foxglove/studio-base/util/Rpc";
import { setupReceiveReportErrorHandler } from "@foxglove/studio-base/util/RpcMainThreadUtils";

import {
  RandomAccessDataProvider,
  InitializationResult,
  ExtensionPoint,
  GetMessagesResult,
  GetMessagesTopics,
} from "./types";

const WorkerDataProviderWorker = () => {
  return new Worker(new URL("./WorkerRosbag2DataProvider.worker", import.meta.url));
};

// A Rosbag2DataProvider that runs in a web worker
export default class WorkerRosbag2DataProvider implements RandomAccessDataProvider {
  private worker?: Worker;
  private rpc?: Rpc;
  private options: Options;

  public constructor(options: Options) {
    this.options = options;
  }

  public async initialize(extensionPoint: ExtensionPoint): Promise<InitializationResult> {
    // close any previous initialized workers
    await this.close();

    this.worker = WorkerDataProviderWorker();
    this.rpc = new Rpc(this.worker);
    setupReceiveReportErrorHandler(this.rpc);

    const { progressCallback, reportMetadataCallback } = extensionPoint;

    type ExtensionPointParams<K> = K extends keyof ExtensionPoint
      ? { type: K; data: Parameters<ExtensionPoint[K]>[0] }
      : never;
    this.rpc.receive(
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
              `Unsupported extension point type in WorkerRosbag2DataProvider: ${
                (value as ExtensionPointParams<keyof ExtensionPoint>).type
              }`,
            );
        }
        return undefined;
      },
    );

    return await this.rpc.send("initialize", this.options);
  }

  public async getMessages(
    start: Time,
    end: Time,
    topics: GetMessagesTopics,
  ): Promise<GetMessagesResult> {
    if (!this.rpc) {
      throw new Error("WorkerRosbag2DataProvider not initialized");
    }

    if (topics.encodedMessages) {
      throw new Error("WorkerRosbag2DataProvider only supports parsed messages");
    }

    const rpcRes = await this.rpc.send<{ messages: GetMessagesResult["parsedMessages"] }>(
      "getMessages",
      {
        start,
        end,
        topics: topics.parsedMessages,
      },
    );
    return {
      encodedMessages: undefined,
      parsedMessages: rpcRes.messages,
    };
  }

  public async close(): Promise<void> {
    try {
      await this.rpc?.send("close");
    } finally {
      this.worker?.terminate();
      this.rpc?.terminate();
    }
  }
}
