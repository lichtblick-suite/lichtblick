// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { isPlainObject } from "lodash";

import type { GlobalVariables } from "@foxglove-studio/app/hooks/useGlobalVariables";
import {
  processMessage,
  registerNode,
} from "@foxglove-studio/app/players/UserNodePlayer/nodeRuntimeWorker/registry";
import transform from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/transformer";
import generateRosLib from "@foxglove-studio/app/players/UserNodePlayer/nodeTransformerWorker/typegen";
import Rpc, { Channel, createLinkedChannels } from "@foxglove-studio/app/util/Rpc";

const validateWorkerArgs = (arg: any) => {
  expect(arg).not.toBeInstanceOf(Function);

  if (isPlainObject(arg)) {
    Object.values(arg).forEach((val) => {
      validateWorkerArgs(val);
    });
  } else if (Array.isArray(arg)) {
    arg.forEach(validateWorkerArgs);
  }
};

// One test class that implements both typescript compilation and message transformation.
export default class MockUserNodePlayerWorker {
  port: Channel;

  constructor() {
    const { local, remote } = createLinkedChannels();
    this.port = local;

    (local as any).start = () => {
      // no-op
    };
    const receiver = new Rpc(remote);
    const receiveAndLog = (action: any, impl: any) => {
      receiver.receive(action, (...args) => {
        validateWorkerArgs(args);
        this.messageSpy(action);
        const ret = impl(...args);
        validateWorkerArgs(ret);
        return ret;
      });
    };
    receiveAndLog("generateRosLib", generateRosLib);
    receiveAndLog("transform", transform);
    receiveAndLog("registerNode", registerNode);
    receiveAndLog(
      "processMessage",
      async ({
        message,
        globalVariables,
      }: {
        message: unknown;
        globalVariables: GlobalVariables;
      }) => {
        return processMessage({ message, globalVariables });
      },
    );
  }

  // So tests can spy on what gets called
  messageSpy(_action: string): void {
    // no-op
  }
}
