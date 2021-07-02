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
import inAutomatedRunMode from "@foxglove/studio-base/util/inAutomatedRunMode";
import sendNotification from "@foxglove/studio-base/util/sendNotification";
import signal from "@foxglove/studio-base/util/signal";

import { pauseFrameForPromises, MAX_PROMISE_TIMEOUT_TIME_MS } from "./pauseFrameForPromise";

const sendNotificationAny: any = sendNotification;

jest.setTimeout(MAX_PROMISE_TIMEOUT_TIME_MS * 3);
jest.mock("@foxglove/studio-base/util/inAutomatedRunMode", () => jest.fn(() => false));

describe("pauseFrameForPromise", () => {
  afterEach(() => {
    (inAutomatedRunMode as any).mockImplementation(() => false);
  });

  it("always reports an error in automated run mode", async () => {
    (inAutomatedRunMode as any).mockImplementation(() => true);
    const promise = signal();
    void pauseFrameForPromises([{ promise, name: "dummy" }]);
    await delay(MAX_PROMISE_TIMEOUT_TIME_MS + 20);

    expect(sendNotificationAny.mock.calls[0][3]).toEqual("error");
    sendNotification.expectCalledDuringTest();
  });
});
