/** @jest-environment jsdom */
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

import delay from "@foxglove/studio-base/util/delay";
import sendNotification, {
  setNotificationHandler,
} from "@foxglove/studio-base/util/sendNotification";

import Rpc, { createLinkedChannels } from "./Rpc";
import { setupReceiveReportErrorHandler } from "./RpcMainThreadUtils";
import { setupSendReportNotificationHandler } from "./RpcWorkerUtils";

describe("RpcWorkerUtils and RpcMainThreadUtils", () => {
  describe("sendNotification", () => {
    // We have to test sending and receiving errors separately because in tests we really only have one thread, so we
    // can't separate `sendNotification` calls on the local and remote threads.
    it("propagates sending errors correctly", async () => {
      const { local: mainChannel, remote: workerChannel } = createLinkedChannels();
      const main = new Rpc(mainChannel);
      let errorObject;
      main.receive("sendNotification", (err) => {
        errorObject = err;
      });

      const worker = new Rpc(workerChannel);
      setupSendReportNotificationHandler(worker);
      sendNotification("test", new Error("details"), "user", "error");
      await delay(10);
      expect(errorObject).toEqual({
        message: "test",
        details: "Error: details",
        type: "user",
        severity: "error",
      });

      sendNotification.expectCalledDuringTest();
    });

    it("propagates receiving errors correctly", async () => {
      const { local: mainChannel, remote: workerChannel } = createLinkedChannels();
      const main = new Rpc(mainChannel);
      setupReceiveReportErrorHandler(main);
      let errorObject;
      setNotificationHandler((message, details, type, severity) => {
        errorObject = { message, details, type, severity };
      });

      const worker = new Rpc(workerChannel);
      void worker.send("sendNotification", {
        message: "test",
        details: "details",
        type: "user",
        severity: "error",
      });
      await delay(10);
      expect(errorObject).toEqual({
        message: "test",
        details: "details",
        type: "user",
        severity: "error",
      });

      sendNotification.expectCalledDuringTest();
    });
  });
});
