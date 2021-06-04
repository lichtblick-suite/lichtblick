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

import sendNotification, {
  DetailsType,
  NotificationSeverity,
  NotificationType,
} from "@foxglove/studio-base/util/sendNotification";

import Rpc from "./Rpc";

// This function should be called inside the parent thread; it sets up receiving a message from the worker thread and
// calling sendNotification.
export function setupReceiveReportErrorHandler(rpc: Rpc): void {
  rpc.receive(
    "sendNotification",
    ({
      message,
      details,
      type,
      severity,
    }: {
      message: string;
      details: DetailsType;
      type: NotificationType;
      severity: NotificationSeverity;
    }) => {
      sendNotification(message, details, type, severity);
    },
  );
}

export function setupMainThreadRpc(rpc: Rpc): void {
  setupReceiveReportErrorHandler(rpc);
}
