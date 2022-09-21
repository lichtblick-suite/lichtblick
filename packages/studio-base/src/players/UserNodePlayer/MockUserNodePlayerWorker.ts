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

import Rpc, { Channel, createLinkedChannels } from "@foxglove/studio-base/util/Rpc";

import { processMessage, registerNode } from "./nodeRuntimeWorker/registry";
import generateRosLib from "./nodeTransformerWorker/generateRosLib";
import transform from "./nodeTransformerWorker/transform";

const validateWorkerArgs = (arg: unknown) => {
  expect(arg).not.toBeInstanceOf(Function);

  if (isPlainObject(arg) && typeof arg === "object" && arg != undefined) {
    Object.values(arg).forEach((val) => {
      validateWorkerArgs(val);
    });
  } else if (Array.isArray(arg)) {
    arg.forEach(validateWorkerArgs);
  }
};

// One test class that implements both typescript compilation and message transformation.
// ts-prune-ignore-next
export default class MockUserNodePlayerWorker {
  public port: Channel;

  public constructor() {
    const { local, remote } = createLinkedChannels();
    this.port = local;

    (local as { start?: () => void }).start = () => {
      // no-op
    };
    const receiver = new Rpc(remote);
    const receiveAndLog = <Args extends unknown[]>(
      action: string,
      impl: (..._: Args) => unknown,
    ) => {
      receiver.receive(action, (...args) => {
        validateWorkerArgs(args);
        this.messageSpy(action);
        const ret = impl(...(args as unknown as Args));
        validateWorkerArgs(ret);
        return ret;
      });
    };
    receiveAndLog("generateRosLib", generateRosLib);
    receiveAndLog("transform", transform);
    receiveAndLog("registerNode", registerNode);
    receiveAndLog("processMessage", processMessage);
  }

  // So tests can spy on what gets called
  public messageSpy(_action: string): void {
    // no-op
  }
}
