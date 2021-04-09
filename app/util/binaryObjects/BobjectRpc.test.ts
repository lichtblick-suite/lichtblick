// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { cast } from "@foxglove-studio/app/players/types";
import Rpc, { createLinkedChannels } from "@foxglove-studio/app/util/Rpc";
import { deepParse, getObject, wrapJsObject } from "@foxglove-studio/app/util/binaryObjects";
import {
  BobjectRpcSender,
  BobjectRpcReceiver,
} from "@foxglove-studio/app/util/binaryObjects/BobjectRpc";
import {
  definitions,
  HasComplexAndArray,
} from "@foxglove-studio/app/util/binaryObjects/messageDefinitionTestTypes";
import signal from "@foxglove-studio/app/util/signal";

const datatype = "fake_msgs/HasComplexAndArray";

const js = {
  header: {
    stamp: { sec: 0, nsec: 0 },
    seq: 0,
    frame_id: "",
  },
  stringArray: ["as", "df"],
};
const parsedBobject = cast<HasComplexAndArray>(wrapJsObject(definitions, datatype, js));

const intArray = new Int32Array([
  ...[0, 0, 0, 0, 0], //header
  ...[2, 28], // string array
  ...[2, 0, 2, 2], // string array index data (into bigString)
]);
const bigString = "asdf";
const binaryBobject = cast<HasComplexAndArray>(
  getObject(definitions, datatype, intArray.buffer, bigString),
);

const topic = "/topic";
const receiveTime = { sec: 1, nsec: 2 };

describe("BobjectRpc", () => {
  it("can send parsed -> parsed", async () => {
    const { local, remote } = createLinkedChannels();
    const sender = new BobjectRpcSender(new Rpc(local));
    const receiver = new BobjectRpcReceiver(new Rpc(remote));
    const promise = signal();

    receiver.receive("action name", "parsed", async (msg) => {
      expect(msg).toEqual({ topic, receiveTime, message: js });
      promise.resolve(undefined);
    });
    sender.send("action name", { topic, receiveTime, message: parsedBobject });
    await promise;
  });

  it("can send parsed -> bobject", async () => {
    const { local, remote } = createLinkedChannels();
    const sender = new BobjectRpcSender(new Rpc(local));
    const receiver = new BobjectRpcReceiver(new Rpc(remote));
    const promise = signal();

    receiver.receive("action name", "bobject", async (msg) => {
      expect(msg.topic).toBe(topic);
      expect(msg.receiveTime).toEqual(receiveTime);
      expect(deepParse(msg.message)).toEqual(js);
      promise.resolve(undefined);
    });
    sender.send("action name", { topic, receiveTime, message: parsedBobject });
    await promise;
  });

  it("can send binary -> parsed", async () => {
    const { local, remote } = createLinkedChannels();
    const sender = new BobjectRpcSender(new Rpc(local));
    const receiver = new BobjectRpcReceiver(new Rpc(remote));
    const promise = signal();

    receiver.receive("action name", "parsed", async (msg) => {
      expect(msg).toEqual({ topic, receiveTime, message: js });
      promise.resolve(undefined);
    });
    sender.send("action name", { topic, receiveTime, message: binaryBobject });
    await promise;
  });

  it("can send binary -> bobject", async () => {
    const { local, remote } = createLinkedChannels();
    const sender = new BobjectRpcSender(new Rpc(local));
    const receiver = new BobjectRpcReceiver(new Rpc(remote));
    const promise = signal();

    receiver.receive("action name", "bobject", async (msg) => {
      expect(msg.topic).toBe(topic);
      expect(msg.receiveTime).toEqual(receiveTime);
      expect(deepParse(msg.message)).toEqual(js);
      promise.resolve(undefined);
    });
    sender.send("action name", { topic, receiveTime, message: binaryBobject });
    await promise;
  });
});
