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
  DataProvider,
  DataProviderDescriptor,
  DataProviderMetadata,
  GetMessagesTopics,
} from "@foxglove/studio-base/dataProviders/types";
import Rpc from "@foxglove/studio-base/util/Rpc";
import { setupWorker } from "@foxglove/studio-base/util/RpcWorkerUtils";

// The "other side" of `RpcDataProvider`. Instantiates a `DataProviderDescriptor` tree underneath,
// in the context of wherever this is instantiated (e.g. a Web Worker, or the server side of a
// WebSocket).
export default class RpcDataProviderRemote {
  constructor(rpc: Rpc, getDataProvider: (arg0: DataProviderDescriptor) => DataProvider) {
    setupWorker(rpc);
    let provider: DataProvider;
    rpc.receive(
      "initialize",
      async ({ childDescriptor }: { childDescriptor: DataProviderDescriptor }) => {
        provider = getDataProvider(childDescriptor);
        return provider.initialize({
          progressCallback: (data) => {
            rpc.send("extensionPointCallback", { type: "progressCallback", data });
          },
          reportMetadataCallback: (data: DataProviderMetadata) => {
            rpc.send("extensionPointCallback", { type: "reportMetadataCallback", data });
          },
        });
      },
    );
    rpc.receive(
      "getMessages",
      async ({
        start,
        end,
        topics,
      }: {
        start: Time;
        end: Time;
        topics: GetMessagesTopics["rosBinaryMessages"];
      }) => {
        const messages = await provider.getMessages(start, end, { rosBinaryMessages: topics });
        const { parsedMessages, rosBinaryMessages } = messages;
        const messagesToSend = rosBinaryMessages ?? [];
        if (parsedMessages != undefined) {
          throw new Error(
            "RpcDataProvider only accepts raw messages (that still need to be parsed with ParseMessagesDataProvider)",
          );
        }
        const arrayBuffers = new Set();
        for (const message of messagesToSend) {
          arrayBuffers.add(message.message);
        }
        return { messages: messagesToSend, [Rpc.transferables]: Array.from(arrayBuffers) };
      },
    );

    rpc.receive("close", () => provider.close());
  }
}
