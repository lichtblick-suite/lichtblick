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
import Rosbag2DataProvider, {
  Options,
} from "@foxglove/studio-base/randomAccessDataProviders/Rosbag2DataProvider";
import {
  RandomAccessDataProvider,
  RandomAccessDataProviderMetadata,
  GetMessagesTopics,
} from "@foxglove/studio-base/randomAccessDataProviders/types";
import Rpc, { Channel } from "@foxglove/studio-base/util/Rpc";
import { setupWorker } from "@foxglove/studio-base/util/RpcWorkerUtils";
import { inWebWorker } from "@foxglove/studio-base/util/workers";

if (inWebWorker()) {
  // not yet using TS Worker lib: FG-64
  const rpc = new Rpc(global as unknown as Channel);

  setupWorker(rpc);
  let provider: RandomAccessDataProvider;
  rpc.receive("initialize", async (options: Options) => {
    provider = new Rosbag2DataProvider(options);
    return await provider.initialize({
      progressCallback: (data) => {
        void rpc.send("extensionPointCallback", { type: "progressCallback", data });
      },
      reportMetadataCallback: (data: RandomAccessDataProviderMetadata) => {
        void rpc.send("extensionPointCallback", { type: "reportMetadataCallback", data });
      },
    });
  });
  rpc.receive(
    "getMessages",
    async ({
      start,
      end,
      topics,
    }: {
      start: Time;
      end: Time;
      topics: GetMessagesTopics["parsedMessages"];
    }) => {
      const messages = await provider.getMessages(start, end, { parsedMessages: topics });
      return { messages: messages.parsedMessages };
    },
  );

  rpc.receive("close", async () => await provider.close());
}
