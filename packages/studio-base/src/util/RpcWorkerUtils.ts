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

import {
  setNotificationHandler,
  DetailsType,
  NotificationType,
  NotificationSeverity,
} from "@foxglove/studio-base/util/sendNotification";

import Rpc from "./Rpc";
import overwriteFetch from "./overwriteFetch";

export function setupSendReportNotificationHandler(rpc: Rpc): void {
  setNotificationHandler(
    (
      message: string,
      details: DetailsType,
      type: NotificationType,
      severity: NotificationSeverity,
    ) => {
      if (!(details instanceof Error || typeof details === "string")) {
        console.warn("Invalid Error type", details);
      }
      void rpc.send("sendNotification", {
        message,
        details: details instanceof Error ? details.toString() : details,
        type,
        severity,
      });
    },
  );
}

export function setupWorker(rpc: Rpc): void {
  if (process.env.NODE_ENV !== "test") {
    setupSendReportNotificationHandler(rpc);
    overwriteFetch();
  }
}
