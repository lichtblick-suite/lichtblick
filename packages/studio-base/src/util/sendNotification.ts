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

// For some handlers it's important to know if the error was due to the application malfunctioning
// (programming error, dependency being down, etc) or a user mistake (incorrect/malformed data,
// etc). We should generally prevent users from making mistakes in the first place, but sometimes
// its unavoidable to bail out with a generic error message (e.g. when dragging in a malformed
// ROS bag).
import { captureException } from "@sentry/core";
import { SeverityLevel } from "@sentry/types";
import { ReactNode } from "react";

import { AppError } from "@foxglove/studio-base/util/errors";
import { inWebWorker } from "@foxglove/studio-base/util/workers";

export type NotificationType = "app" | "user";
export type DetailsType = string | Error | ReactNode;
export type NotificationSeverity = "error" | "warn" | "info";
export type NotificationHandler = (
  message: string,
  details: DetailsType,
  type: NotificationType,
  severity: NotificationSeverity,
) => void;
export type NotificationMessage = {
  readonly id?: string;
  readonly message: string;
  readonly details: DetailsType;
  readonly subText?: string;
  readonly read?: boolean;
  readonly created?: Date;
  readonly severity: NotificationSeverity;
};

const defaultNotificationHandler: NotificationHandler = (
  message: string,
  details: DetailsType,
  type: NotificationType,
  severity: NotificationSeverity,
): void => {
  if (inWebWorker()) {
    const webWorkerError =
      "Web Worker has uninitialized sendNotification function; this means this error message cannot show up in the UI (so we show it here in the console instead).";
    if (process.env.NODE_ENV === "test") {
      throw new Error(webWorkerError);
    } else {
      const consoleFn =
        severity === "error" ? console.error : severity === "warn" ? console.warn : console.info;
      consoleFn(webWorkerError, message, details, type);
    }
    return;
  } else if (process.env.NODE_ENV === "test") {
    return;
  }
  console.error("Notification before error display is mounted", message, details, type);
};

let addNotification: NotificationHandler = defaultNotificationHandler;

export function setNotificationHandler(handler: NotificationHandler): void {
  if (addNotification !== defaultNotificationHandler) {
    throw new Error("Tried to overwrite existing NotificationHandler");
  }
  addNotification = handler;
}

export function unsetNotificationHandler(): void {
  if (addNotification === defaultNotificationHandler) {
    throw new Error("Tried to unset NotificationHandler but it was already the default");
  }
  addNotification = defaultNotificationHandler;
}

// Call this to add an notification to the application nav bar error component if mounted.
// If the component is not mounted, use the console as a fallback.
export default function sendNotification(
  message: string,
  details: DetailsType,
  type: NotificationType,
  severity: NotificationSeverity,
): void {
  // We only want to send non-user errors and warnings to Sentry
  if (type === "app") {
    const sentrySeverity: SeverityLevel | undefined =
      severity === "error" ? "error" : severity === "warn" ? "warning" : undefined;
    if (sentrySeverity != undefined) {
      captureException(new AppError(details, message), { level: sentrySeverity });
    }
  }

  addNotification(message, details, type, severity);
}

sendNotification.expectCalledDuringTest = (): void => {
  throw new Error("Should be overriden in setupTestFramework.ts");
};
