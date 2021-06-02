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

// This file provides a mock implementation of sendNotification so tests can assert that a notification
// was sent via a sendNotification call

import type {
  DetailsType,
  NotificationHandler,
  NotificationSeverity,
  NotificationType,
} from "@foxglove/studio-base/util/sendNotification";

let currentHandler: NotificationHandler | undefined = undefined;

const mockSendNotification = jest.fn<
  void,
  [string, DetailsType, NotificationType, NotificationSeverity]
>((...args) => {
  if (currentHandler) {
    currentHandler(...args);
  }
});

const mockSetNotificationHandler = (handler?: NotificationHandler): void => {
  currentHandler = handler;
};

// The sendNotification function is monkey-patched with "expectCalledDuringTest"
// Our jest mock doesn't have such a property and typescript complains
(mockSendNotification as unknown as { expectCalledDuringTest: () => void }).expectCalledDuringTest =
  () => {
    if (mockSendNotification.mock.calls.length === 0) {
      throw new Error(
        "Expected sendNotification to have been called during the test, but it was never called!",
      );
    }
    mockSendNotification.mockClear();
    // Reset the error handler to the default (no error handler).
    mockSetNotificationHandler();
  };

export { mockSendNotification, mockSetNotificationHandler };
