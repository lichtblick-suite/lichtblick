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

import { initI18n } from "@foxglove/studio-base/i18n";
import {
  setupMockSendNotification,
  mockSendNotification,
  mockSetNotificationHandler,
} from "@foxglove/studio-base/test/MockSendNotification";

// Mock out sendNotification for all tests
jest.mock("@foxglove/studio-base/util/sendNotification", () => {
  return {
    __esModule: true,
    default: mockSendNotification,
    setNotificationHandler: mockSetNotificationHandler,
  };
});
beforeEach(() => {
  setupMockSendNotification();
});

// intercept console.error and console.warn calls to fail tests if they are called
// the user can indicate they expect the call to happen by checking the mock.calls
// and then clearing the mock via mockClear()
//
// We assign rather than spy to expose the mock for the user
const origError = console.error;
const origWarn = console.warn;
const consoleErrorMock = (console.error = jest.fn());
const consoleWarnMock = (console.warn = jest.fn());

beforeAll(async () => {
  await initI18n();
});

beforeEach(() => {
  consoleErrorMock.mockClear();
  consoleWarnMock.mockClear();
});

afterEach(() => {
  const calls = consoleErrorMock.mock.calls;

  if (calls.length > 0) {
    // show the user the error messages so they can track them down
    for (const call of calls) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      origError(...call);
    }
    throw new Error(
      `console.error was called in the test.\n\n
If this is expected, check the call values via console.error.mock.calls and
clear with console.error.mockClear()`,
    );
  }
});

afterEach(() => {
  const calls = consoleWarnMock.mock.calls;

  if (calls.length > 0) {
    // show the user the warnings so they can track them down
    for (const call of calls) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      origWarn(...call);
    }
    throw new Error(
      `console.warn was called in the test.\n\n
If this is expected, check the call values via console.warn.mock.calls and
clear with console.warn.mockClear()`,
    );
  }
});

// If sendNotification was called during a test the test must also call expectCalledDuringTest()
// to indicate they expected notifications
afterEach(async () => {
  if (mockSendNotification.mock.calls.length > 0) {
    const calls = mockSendNotification.mock.calls;
    mockSendNotification.mockClear();
    // Reset the error handler to the default (no error handler).
    mockSetNotificationHandler();
    throw new Error(
      `sendNotification has been called during this test (call sendNotification.expectCalledDuringTest(); at the end of your test if you expect this): ${JSON.stringify(
        calls,
      )}`,
    );
  }
});
