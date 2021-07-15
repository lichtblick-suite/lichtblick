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
  RandomAccessDataProvider,
  RandomAccessDataProviderDescriptor,
  RandomAccessDataProviderMetadata,
  GetMessagesTopics,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import Rpc from "@foxglove/studio-base/util/Rpc";
import { setupWorker } from "@foxglove/studio-base/util/RpcWorkerUtils";

// The "other side" of `RpcDataProvider`. Instantiates a `RandomAccessDataProviderDescriptor` tree underneath,
// in the context of wherever this is instantiated (e.g. a Web Worker, or the server side of a
// WebSocket).
export default class RpcDataProviderRemote {
  constructor(
    rpc: Rpc,
    getDataProvider: (arg0: RandomAccessDataProviderDescriptor) => RandomAccessDataProvider,
  ) {
    setupWorker(rpc);
    let provider: RandomAccessDataProvider;
    rpc.receive(
      "initialize",
      async ({ childDescriptor }: { childDescriptor: RandomAccessDataProviderDescriptor }) => {
        provider = getDataProvider(childDescriptor);
        return await provider.initialize({
          progressCallback: (data) => {
            void rpc.send("extensionPointCallback", { type: "progressCallback", data });
          },
          reportMetadataCallback: (data: RandomAccessDataProviderMetadata) => {
            void rpc.send("extensionPointCallback", { type: "reportMetadataCallback", data });
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

    rpc.receive("close", async () => await provider.close());
  }
}
